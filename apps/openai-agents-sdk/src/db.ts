import { MongoClient, Collection, ObjectId, Db } from 'mongodb';
import { Conversation, ConversationEntry } from './types.js';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// MongoDB client singleton
let client: MongoClient | null = null;
let db: Db | null = null;

// Get MongoDB client
export const getMongoClient = async (): Promise<MongoClient> => {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
  }
  return client;
};

// Get database
export const getDb = async (): Promise<Db> => {
  if (!db) {
    const client = await getMongoClient();
    db = client.db('agent_memory');
  }
  return db;
};

// Get conversations collection
export const getConversationsCollection = async (): Promise<Collection<Conversation>> => {
  const database = await getDb();
  return database.collection<Conversation>('conversations');
};

// Create a new conversation
export const createConversation = async (userId: string): Promise<string> => {
  const collection = await getConversationsCollection();

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
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> => {
  const collection = await getConversationsCollection();

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
  conversationId: string
): Promise<ConversationEntry[]> => {
  const collection = await getConversationsCollection();

  const conversation = await collection.findOne(
    { _id: new ObjectId(conversationId) }
  );

  return conversation?.history || [];
};

// Close MongoDB connection when the app terminates
export const closeMongoConnection = async (): Promise<void> => {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
    client = null;
    db = null;
  }
};
