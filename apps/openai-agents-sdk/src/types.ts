import { ObjectId } from 'mongodb';

// Define the conversation history document structure
export type ConversationEntry = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export type Conversation = {
  _id?: ObjectId;
  userId: string;
  history: ConversationEntry[];
  createdAt: Date;
  updatedAt: Date;
};

// Agent run result type
export type AgentRunResult = {
  conversationId: string;
  finalOutput: string;
};
