import { MongoClient, Db, Collection } from 'mongodb';

interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp?: Date;
  [key: string]: any;
}

interface MessageBucket {
  _id?: any;
  conversationId: string;
  createdAt: Date;
  lastModified: Date;
  messages: Array<{
    messageId: string;
    userId: string;
    content: string;
    timestamp: Date;
    [key: string]: any;
  }>;
  metadata: {
    firstMessageAt: Date;
    lastMessageAt: Date;
    messageCount: number;
  };
}

class BucketMessageStorage {
  private db: Db;
  private collection: Collection<MessageBucket>;
  private bucketSize: number;

  constructor(db: Db, collectionName: string = 'conversation_buckets', bucketSize: number = 50) {
    this.db = db;
    this.collection = db.collection<MessageBucket>(collectionName);
    this.bucketSize = bucketSize;
  }

  /**
   * Add a message to a bucket. Creates a new bucket if no non-full bucket exists.
   */
  async addMessageToBucket(conversationId: string, message: Message) {
    const now = new Date();
    
    // First, try to update an existing non-full bucket
    const updateResult = await this.collection.updateOne(
      {
        conversationId: conversationId,
        'metadata.messageCount': { $lt: this.bucketSize }
      },
      {
        $push: {
          messages: {
            messageId: message.id,
            timestamp: message.timestamp || now,
            ...message,
            userId: message.userId,
            content: message.content
          }
        },
        $set: {
          'metadata.lastMessageAt': now,
          lastModified: now
        },
        $inc: {
          'metadata.messageCount': 1
        }
      }
    );

    // If no existing bucket was updated, create a new one
    if (updateResult.matchedCount === 0) {
      const newBucket: MessageBucket = {
        conversationId: conversationId,
        createdAt: now,
        lastModified: now,
        messages: [{
          messageId: message.id,
          timestamp: message.timestamp || now,
          ...message,
          userId: message.userId,
          content: message.content
        }],
        metadata: {
          firstMessageAt: now,
          lastMessageAt: now,
          messageCount: 1
        }
      };

      const insertResult = await this.collection.insertOne(newBucket);
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
        upsertedId: insertResult.insertedId,
        bucketId: insertResult.insertedId,
        isNewBucket: true
      };
    }

    return {
      ...updateResult,
      bucketId: null,
      isNewBucket: false
    };
  }

  /**
   * Get all messages for a conversation across all buckets
   */
  async getConversationMessages(conversationId: string, options: {
    limit?: number;
    skip?: number;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const { limit, skip = 0, sortOrder = 'asc' } = options;
    
    const buckets = await this.collection
      .find({ conversationId })
      .sort({ 'metadata.firstMessageAt': sortOrder === 'asc' ? 1 : -1 })
      .toArray();

    // Flatten all messages from all buckets
    const allMessages = buckets.flatMap(bucket => bucket.messages);
    
    // Sort messages by timestamp
    allMessages.sort((a, b) => {
      const timeA = a.timestamp.getTime();
      const timeB = b.timestamp.getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    // Apply pagination
    const startIndex = skip;
    const endIndex = limit ? startIndex + limit : undefined;
    
    return allMessages.slice(startIndex, endIndex);
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string) {
    const pipeline = [
      { $match: { conversationId } },
      {
        $group: {
          _id: '$conversationId',
          totalBuckets: { $sum: 1 },
          totalMessages: { $sum: '$metadata.messageCount' },
          firstMessage: { $min: '$metadata.firstMessageAt' },
          lastMessage: { $max: '$metadata.lastMessageAt' },
          avgMessagesPerBucket: { $avg: '$metadata.messageCount' }
        }
      }
    ];

    const result = await this.collection.aggregate(pipeline).toArray();
    return result[0] || null;
  }

  /**
   * Get recent messages across all conversations
   */
  async getRecentMessages(limit: number = 100) {
    const pipeline = [
      { $sort: { 'metadata.lastMessageAt': -1 } },
      { $limit: Math.ceil(limit / this.bucketSize) },
      { $unwind: '$messages' },
      { $sort: { 'messages.timestamp': -1 } },
      { $limit: limit },
      {
        $project: {
          conversationId: 1,
          message: '$messages',
          bucketCreatedAt: '$createdAt'
        }
      }
    ];

    return await this.collection.aggregate(pipeline).toArray();
  }

  /**
   * Delete all buckets for a conversation
   */
  async deleteConversation(conversationId: string) {
    return await this.collection.deleteMany({ conversationId });
  }

  /**
   * Get bucket information for debugging
   */
  async getBucketInfo(conversationId: string) {
    return await this.collection
      .find({ conversationId })
      .project({
        _id: 1,
        createdAt: 1,
        'metadata.messageCount': 1,
        'metadata.firstMessageAt': 1,
        'metadata.lastMessageAt': 1
      })
      .sort({ 'metadata.firstMessageAt': 1 })
      .toArray();
  }

  /**
   * Create indexes for optimal performance
   */
  async createIndexes() {
    await this.collection.createIndexes([
      // Index for finding non-full buckets
      {
        key: { conversationId: 1, 'metadata.messageCount': 1 },
        name: 'conversationId_messageCount'
      },
      // Index for conversation queries
      {
        key: { conversationId: 1, 'metadata.firstMessageAt': 1 },
        name: 'conversationId_firstMessageAt'
      },
      // Index for recent messages
      {
        key: { 'metadata.lastMessageAt': -1 },
        name: 'lastMessageAt_desc'
      },
      // Index for message searches within buckets
      {
        key: { conversationId: 1, 'messages.timestamp': 1 },
        name: 'conversationId_messageTimestamp'
      }
    ]);
  }
}

// Utility function to get MongoDB connection
let cachedClient: MongoClient | null = null;

async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  cachedClient = new MongoClient(mongoUri);
  await cachedClient.connect();
  return cachedClient;
}

// Factory function to create bucket storage instance
export async function createBucketStorage(
  dbName: string = 'message_storage',
  collectionName: string = 'conversation_buckets',
  bucketSize: number = 50
): Promise<BucketMessageStorage> {
  const client = await getMongoClient();
  const db = client.db(dbName);
  const storage = new BucketMessageStorage(db, collectionName, bucketSize);
  
  // Create indexes on first use
  await storage.createIndexes();
  
  return storage;
}

// Simplified function matching your original API
export async function addMessageToBucket(conversationId: string, message: Message) {
  const storage = await createBucketStorage();
  return await storage.addMessageToBucket(conversationId, message);
}

export { BucketMessageStorage, type Message, type MessageBucket };
