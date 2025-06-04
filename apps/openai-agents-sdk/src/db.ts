import { MongoClient, ObjectId, Db } from 'mongodb';
import { Conversation, ConversationEntry } from './types.js';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Connect to MongoDB and get database instance
export const connectToMongoDB = async (): Promise<{ client: MongoClient; db: Db }> => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db('agent_memory');
  return { client, db };
};

// Create a new conversation
export const createConversation = async (db: Db, userId: string): Promise<string> => {
  const collection = db.collection<Conversation>('conversations');

  const conversation: Conversation = {
    userId,
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(conversation);
  return result.insertedId.toString();
};

// Add entry to conversation history
export const addToConversationHistory = async (
  db: Db,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> => {
  const collection = db.collection<Conversation>('conversations');

  const entry: ConversationEntry = {
    role,
    content,
    timestamp: new Date(),
  };

  await collection.updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $push: { history: entry },
      $set: { updatedAt: new Date() }
    }
  );
};

// Get conversation history
export const getConversationHistory = async (
  db: Db,
  conversationId: string
): Promise<ConversationEntry[]> => {
  const collection = db.collection<Conversation>('conversations');

  const conversation = await collection.findOne(
    { _id: new ObjectId(conversationId) }
  );

  return conversation?.history || [];
};

// Close MongoDB connection
export const closeMongoConnection = async (client: MongoClient): Promise<void> => {
  await client.close();
  console.log('Disconnected from MongoDB');
};
