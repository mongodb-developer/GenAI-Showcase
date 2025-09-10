import { connectionPool } from "./connection-pool"
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"

interface MemoryConfig {
  vectorStore: {
    provider: string
    config: {
      client: MongoDBAtlasVectorSearch
    }
  }
  disableHistory?: boolean
}

interface SearchOptions {
  userId?: string
  limit?: number
}

interface AddOptions {
  userId?: string
  metadata?: Record<string, any>
}

class CustomMemory {
  private vectorStore: MongoDBAtlasVectorSearch
  private disableHistory: boolean

  constructor(config: MemoryConfig) {
    this.vectorStore = config.vectorStore.config.client
    this.disableHistory = config.disableHistory || false
  }

  async search(query: string, options: SearchOptions = {}): Promise<any[]> {
    try {
      console.log("[CustomMemory] Searching for:", query, "with options:", options)
      
      // Create filter for userId if provided
      const filter = options.userId ? { userId: options.userId } : {}
      console.log("[CustomMemory] Using filter:", filter)
      
      // Use the vector store to search for similar documents with userId filter
      const results = await this.vectorStore.similaritySearch(
        query, 
        options.limit || 10,
        filter
      )
      
      console.log("[CustomMemory] Found results:", results.length)
      
      // Transform results to match expected format
      return results.map((result, index) => ({
        id: `result_${index}`,
        data: result.pageContent,
        memory: result.pageContent,
        text: result.pageContent,
        metadata: {
          ...result.metadata,
          userId: options.userId,
          score: result.metadata?.score || 0.8
        }
      }))
    } catch (error) {
      console.error("[CustomMemory] Search error:", error)
      return []
    }
  }

  async add(messages: any[], options: AddOptions = {}): Promise<void> {
    try {
      console.log("[CustomMemory] Adding memory:", messages.length, "messages")
      
      // Extract content from messages
      const content = messages.map(msg => 
        typeof msg === 'string' ? msg : msg.content || JSON.stringify(msg)
      ).join(' ')

      if (!content.trim()) {
        console.log("[CustomMemory] No content to add")
        return
      }

      // Create document with metadata
      const document = {
        pageContent: content,
        metadata: {
          ...options.metadata,
          userId: options.userId,
          timestamp: new Date().toISOString(),
          source: 'custom-memory'
        }
      }

      // Add to vector store
      await this.vectorStore.addDocuments([document])
      console.log("[CustomMemory] Successfully added memory")
    } catch (error) {
      console.error("[CustomMemory] Add error:", error)
      // Don't throw, just log the error
    }
  }

  async delete(memoryId: string): Promise<void> {
    console.log("[CustomMemory] Delete not implemented for:", memoryId)
    // Vector stores typically don't support individual document deletion
  }

  async update(memoryId: string, data: any): Promise<void> {
    console.log("[CustomMemory] Update not implemented for:", memoryId, data)
    // Vector stores typically don't support individual document updates
  }

  async reset(): Promise<void> {
    console.log("[CustomMemory] Reset not implemented")
    // Would require dropping the entire collection
  }
}

let memoryInstance: CustomMemory | null = null

export async function getMemory(): Promise<CustomMemory> {
  console.log("[CustomMemory] getMemory() called")

  if (!memoryInstance) {
    console.log("[CustomMemory] Creating new memory instance using connection pool")

    try {
      console.log("[CustomMemory] Getting vector store from connection pool...")
      const vectorStore = await connectionPool.getVectorStore()
      console.log("[CustomMemory] Vector store obtained successfully")

      console.log("[CustomMemory] Creating Memory instance...")
      memoryInstance = new CustomMemory({
        vectorStore: {
          provider: "langchain",
          config: { client: vectorStore },
        },
        disableHistory: true,
      })
      console.log("[CustomMemory] Memory instance created successfully")
    } catch (error) {
      console.error("[CustomMemory] Error creating memory instance:", error)
      console.error("[CustomMemory] Error details:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  } else {
    console.log("[CustomMemory] Using existing memory instance")
  }

  return memoryInstance
}

export const version = () => "Custom Memory implementation using MongoDB Atlas vector store (no SQLite)"
