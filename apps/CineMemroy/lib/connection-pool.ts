import { MongoClient } from "mongodb"
import { OpenAIEmbeddings } from "@langchain/openai"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"

interface ConnectionConfig {
  mongoUri: string
  openaiKey: string
  embeddingModel: string
  dbName: string
  collectionName: string
}

class ConnectionPool {
  private static instance: ConnectionPool | null = null
  private mongoClient: MongoClient | null = null
  private embeddings: OpenAIEmbeddings | null = null
  private vectorStore: MongoDBAtlasVectorSearch | null = null
  private config: ConnectionConfig | null = null
  private isConnecting: boolean = false

  private constructor() {}

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool()
    }
    return ConnectionPool.instance
  }

  private loadConfig(): ConnectionConfig {
    if (this.config) {
      return this.config
    }

    const mongoUri = process.env.MONGODB_URI
    const openaiKey = process.env.OPENAI_API_KEY
    const embeddingModel = process.env.EMBEDDING_MODEL || "text-embedding-3-small"
    const dbName = process.env.MEMORY_DB || "mem0_agent_memory"
    const collectionName = process.env.MEMORY_COLLECTION || "extracted_memories"

    if (!mongoUri || typeof mongoUri !== 'string') {
      throw new Error("MONGODB_URI environment variable is required and must be a string")
    }

    if (!openaiKey || typeof openaiKey !== 'string') {
      throw new Error("OPENAI_API_KEY environment variable is required and must be a string")
    }

    this.config = {
      mongoUri,
      openaiKey,
      embeddingModel,
      dbName,
      collectionName
    }

    console.log("[ConnectionPool] Configuration loaded:", {
      hasMongoUri: !!mongoUri,
      hasOpenaiKey: !!openaiKey,
      embeddingModel,
      dbName,
      collectionName
    })

    return this.config
  }

  async getMongoClient(): Promise<MongoClient> {
    if (this.mongoClient) {
      // Check if connection is still alive
      try {
        await this.mongoClient.db("admin").command({ ping: 1 })
        return this.mongoClient
      } catch (error) {
        console.log("[ConnectionPool] MongoDB connection lost, reconnecting...")
        this.mongoClient = null
      }
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      if (this.mongoClient) {
        return this.mongoClient
      }
    }

    this.isConnecting = true
    try {
      const config = this.loadConfig()
      console.log("[ConnectionPool] Creating new MongoDB client...")
      
      this.mongoClient = new MongoClient(config.mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })

      await this.mongoClient.connect()
      console.log("[ConnectionPool] MongoDB client connected successfully")
      
      return this.mongoClient
    } catch (error) {
      console.error("[ConnectionPool] Failed to connect to MongoDB:", error)
      this.mongoClient = null
      throw error
    } finally {
      this.isConnecting = false
    }
  }

  getEmbeddings(): OpenAIEmbeddings {
    if (this.embeddings) {
      return this.embeddings
    }

    const config = this.loadConfig()
    console.log("[ConnectionPool] Creating OpenAI embeddings...")
    
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiKey,
      modelName: config.embeddingModel,
    })

    console.log("[ConnectionPool] OpenAI embeddings created successfully")
    return this.embeddings
  }

  async getVectorStore(): Promise<MongoDBAtlasVectorSearch> {
    if (this.vectorStore) {
      return this.vectorStore
    }

    const config = this.loadConfig()
    const client = await this.getMongoClient()
    const embeddings = this.getEmbeddings()

    console.log("[ConnectionPool] Creating MongoDB Atlas vector store...")
    
    this.vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection: client.db(config.dbName).collection(config.collectionName),
      indexName: "vector_index",
      textKey: "text",
      embeddingKey: "embedding",
    })

    console.log("[ConnectionPool] MongoDB Atlas vector store created successfully")
    return this.vectorStore
  }

  async close(): Promise<void> {
    if (this.mongoClient) {
      console.log("[ConnectionPool] Closing MongoDB connection...")
      await this.mongoClient.close()
      this.mongoClient = null
    }
    
    this.embeddings = null
    this.vectorStore = null
    this.config = null
    console.log("[ConnectionPool] All connections closed")
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.mongoClient) {
        return false
      }
      
      await this.mongoClient.db("admin").command({ ping: 1 })
      return true
    } catch (error) {
      console.error("[ConnectionPool] Health check failed:", error)
      return false
    }
  }
}

export const connectionPool = ConnectionPool.getInstance()

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log("[ConnectionPool] Received SIGINT, closing connections...")
  await connectionPool.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log("[ConnectionPool] Received SIGTERM, closing connections...")
  await connectionPool.close()
  process.exit(0)
})
