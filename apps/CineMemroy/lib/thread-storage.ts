import { MongoClient, Db, Collection } from 'mongodb';
import { createBucketStorage, type Message, type MessageBucket } from './bucket-storage';

interface ThreadMessage {
  id: string;
  threadId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    type?: 'short' | 'long' | 'episodic' | 'procedural';
    confidence?: number;
    occurred_at?: string;
    source?: string;
    [key: string]: any;
  };
}

interface Thread {
  _id?: any;
  threadId: string;
  userId: string;
  title?: string;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
  isActive: boolean;
  metadata?: {
    tags?: string[];
    summary?: string;
    [key: string]: any;
  };
}

class ThreadStorage {
  private db: Db;
  public threadsCollection: Collection<Thread>;
  private bucketStorage: any;

  constructor(db: Db) {
    this.db = db;
    this.threadsCollection = db.collection<Thread>('threads');
  }

  async initialize() {
    // Initialize bucket storage for messages
    this.bucketStorage = await createBucketStorage(
      this.db.databaseName,
      'thread_message_buckets',
      50
    );

    // Create indexes for threads
    await this.threadsCollection.createIndexes([
      { key: { userId: 1, lastActivity: -1 }, name: 'userId_lastActivity' },
      { key: { threadId: 1 }, name: 'threadId', unique: true },
      { key: { userId: 1, isActive: 1 }, name: 'userId_isActive' },
      { key: { lastActivity: -1 }, name: 'lastActivity_desc' }
    ]);
  }

  /**
   * Create a new thread or get existing one
   */
  async createOrGetThread(threadId: string, userId: string, title?: string): Promise<Thread> {
    const now = new Date();
    
    const result = await this.threadsCollection.findOneAndUpdate(
      { threadId },
      {
        $setOnInsert: {
          threadId,
          userId,
          title: title || `Thread ${threadId}`,
          createdAt: now,
          messageCount: 0,
          isActive: true,
          metadata: {}
        },
        $set: {
          lastActivity: now
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result!;
  }

  /**
   * Add a message to a thread using bucket storage
   */
  async addMessage(threadId: string, message: Omit<ThreadMessage, 'threadId'>): Promise<any> {
    const now = new Date();
    
    // Prepare message for bucket storage
    const bucketMessage: Message = {
      id: message.id,
      userId: message.userId,
      content: message.content,
      timestamp: message.timestamp || now,
      role: message.role,
      metadata: message.metadata
    };

    // Add to bucket storage
    const bucketResult = await this.bucketStorage.addMessageToBucket(threadId, bucketMessage);

    // Update thread metadata
    await this.threadsCollection.updateOne(
      { threadId },
      {
        $set: {
          lastActivity: now,
          isActive: true
        },
        $inc: {
          messageCount: 1
        }
      }
    );

    return bucketResult;
  }

  /**
   * Get messages from a thread with pagination
   */
  async getThreadMessages(
    threadId: string,
    options: {
      limit?: number;
      skip?: number;
      sortOrder?: 'asc' | 'desc';
      includeShortTerm?: boolean;
    } = {}
  ): Promise<ThreadMessage[]> {
    const messages = await this.bucketStorage.getConversationMessages(threadId, options);
    
    return messages.map((msg: any) => ({
      id: msg.messageId,
      threadId,
      userId: msg.userId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: msg.metadata
    }));
  }

  /**
   * Get recent messages for short-term memory (last 24 hours)
   */
  async getRecentMessages(
    userId: string,
    limit: number = 6,
    threadId?: string
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    let query: any = { userId };
    if (threadId) {
      query.threadId = threadId;
    }

    // Get recent threads for this user
    const recentThreads = await this.threadsCollection
      .find({
        userId,
        lastActivity: { $gte: twentyFourHoursAgo },
        isActive: true
      })
      .sort({ lastActivity: -1 })
      .limit(5)
      .toArray();

    const allMessages: ThreadMessage[] = [];

    // Get messages from each recent thread
    for (const thread of recentThreads) {
      const messages = await this.getThreadMessages(thread.threadId, {
        limit: Math.ceil(limit / recentThreads.length),
        sortOrder: 'desc'
      });
      
      // Filter messages from last 24 hours
      const recentMessages = messages.filter(
        msg => msg.timestamp >= twentyFourHoursAgo
      );
      
      allMessages.push(...recentMessages);
    }

    // Sort all messages by timestamp and take the most recent
    allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return allMessages
      .slice(0, limit)
      .reverse() // Return in chronological order
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  /**
   * Get thread statistics
   */
  async getThreadStats(threadId: string) {
    const thread = await this.threadsCollection.findOne({ threadId });
    if (!thread) return null;

    const bucketStats = await this.bucketStorage.getConversationStats(threadId);
    
    return {
      ...thread,
      bucketStats
    };
  }

  /**
   * List user's threads
   */
  async getUserThreads(
    userId: string,
    options: {
      limit?: number;
      skip?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<Thread[]> {
    const { limit = 20, skip = 0, includeInactive = false } = options;
    
    const query: any = { userId };
    if (!includeInactive) {
      query.isActive = true;
    }

    return await this.threadsCollection
      .find(query)
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * Archive a thread (mark as inactive)
   */
  async archiveThread(threadId: string): Promise<boolean> {
    const result = await this.threadsCollection.updateOne(
      { threadId },
      { 
        $set: { 
          isActive: false,
          lastActivity: new Date()
        } 
      }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Delete a thread and all its messages
   */
  async deleteThread(threadId: string): Promise<boolean> {
    // Delete from bucket storage
    await this.bucketStorage.deleteConversation(threadId);
    
    // Delete thread record
    const result = await this.threadsCollection.deleteOne({ threadId });
    
    return result.deletedCount > 0;
  }

  /**
   * Update thread metadata
   */
  async updateThread(
    threadId: string,
    updates: {
      title?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const updateDoc: any = {
      lastActivity: new Date()
    };
    
    if (updates.title) {
      updateDoc.title = updates.title;
    }
    
    if (updates.metadata) {
      updateDoc.metadata = { ...updateDoc.metadata, ...updates.metadata };
    }

    const result = await this.threadsCollection.updateOne(
      { threadId },
      { $set: updateDoc }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * Search messages across threads
   */
  async searchMessages(
    userId: string,
    searchTerm: string,
    options: {
      threadId?: string;
      limit?: number;
      messageTypes?: string[];
    } = {}
  ): Promise<ThreadMessage[]> {
    // This would require text search indexes on the bucket storage
    // For now, we'll implement a basic search by getting recent messages
    // and filtering client-side (not optimal for large datasets)
    
    const threads = options.threadId 
      ? [{ threadId: options.threadId }]
      : await this.getUserThreads(userId, { limit: 10 });

    const allMessages: ThreadMessage[] = [];
    
    for (const thread of threads) {
      const messages = await this.getThreadMessages(thread.threadId, {
        limit: 100 // Reasonable limit for search
      });
      
      const matchingMessages = messages.filter(msg =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      allMessages.push(...matchingMessages);
    }

    return allMessages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, options.limit || 20);
  }
}

// Utility functions
let cachedClient: MongoClient | null = null;
let cachedThreadStorage: ThreadStorage | null = null;

async function getMongoClient(): Promise<MongoClient> {
  // Check if we have a valid cached client
  if (cachedClient) {
    try {
      // Test the connection with a simple ping
      await cachedClient.db('admin').admin().ping();
      return cachedClient;
    } catch (error) {
      console.warn('Cached MongoDB client connection invalid, recreating:', error);
      // Clear the cached client if ping fails
      try {
        await cachedClient.close();
      } catch (closeError) {
        console.warn('Error closing previous MongoDB client:', closeError);
      }
      cachedClient = null;
    }
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  cachedClient = new MongoClient(mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  
  await cachedClient.connect();
  return cachedClient;
}

export async function getThreadStorage(): Promise<ThreadStorage> {
  try {
    // Always check if cached storage is still valid
    if (cachedThreadStorage) {
      // Test the connection by trying a simple operation
      try {
        await cachedThreadStorage.threadsCollection.findOne({}, { limit: 1 });
        return cachedThreadStorage;
      } catch (error) {
        console.warn('Cached thread storage connection invalid, recreating:', error);
        cachedThreadStorage = null;
      }
    }

    const client = await getMongoClient();
    const db = client.db(process.env.MEM0_DB || 'mem0_agent_memory');
    
    cachedThreadStorage = new ThreadStorage(db);
    await cachedThreadStorage.initialize();
    
    return cachedThreadStorage;
  } catch (error) {
    console.error('Error getting thread storage:', error);
    // Clear cache on error
    cachedThreadStorage = null;
    cachedClient = null;
    throw error;
  }
}

// Backward compatibility functions for existing shortStore API
export async function saveTurns(
  userId: string,
  turns: Array<{ role: 'user' | 'assistant'; content: string }>,
  threadId: string = 'default'
) {
  const storage = await getThreadStorage();
  
  // Ensure thread exists
  await storage.createOrGetThread(threadId, userId);
  
  // Add each turn as a message
  for (const turn of turns) {
    await storage.addMessage(threadId, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      role: turn.role,
      content: turn.content,
      timestamp: new Date(),
      metadata: {
        type: 'short',
        source: 'chat-api'
      }
    });
  }
}

export async function getRecent(
  userId: string,
  k: number = 6,
  threadId?: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const storage = await getThreadStorage();
  return await storage.getRecentMessages(userId, k, threadId);
}

export { ThreadStorage, type ThreadMessage, type Thread };
