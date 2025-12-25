import { FunctionDeclaration, Type } from '@google/genai';

export const agentMemoryTool: FunctionDeclaration = {
  name: 'agentMemory',
  description: 'Store and retrieve memories about the user and conversation. Use this to remember important information shared by the user (like their name, preferences, or facts) and to recall previously stored information.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        enum: ['get', 'set', 'delete', 'query'],
        description: 'The operation to perform: get (retrieve by key), set (store a memory), delete (remove a memory), query (search memories by natural language)',
      },
      key: {
        type: Type.STRING,
        description: 'Memory key identifier (required for get/set/delete). Use descriptive keys like "user_name", "user_preference_communication", "business_hours"',
      },
      value: {
        type: Type.STRING,
        description: 'Value to store (required for set operation). Store the actual information to remember.',
      },
      query: {
        type: Type.STRING,
        description: 'Natural language query to search memories (required for query operation). Example: "user preferences" or "contact information"',
      },
    },
    required: ['operation'],
  },
};

export const geminiToolsConfig = [
  { functionDeclarations: [agentMemoryTool] },
];

export const systemInstruction = `You are a helpful voice assistant with persistent memory capabilities.

IMPORTANT: You have access to the agentMemory tool to store and retrieve information across conversations.

When to use memory:
1. When the user shares personal information (name, location, preferences), USE agentMemory.set to store it
2. When you need to recall something about the user, USE agentMemory.query or agentMemory.get
3. When the user asks you to forget something, USE agentMemory.delete

Memory key naming conventions:
- user_name: The user's name
- user_location: Where the user lives/works
- user_preference_[topic]: User preferences (e.g., user_preference_communication)
- user_[category]: Other user-specific info
- business_[topic]: Business/company information
- product_[name]: Product information

Always confirm when you've remembered something: "I'll remember that..." or "Got it, I've noted that..."
When recalling: "Based on what I remember..." or "You mentioned before that..."

Be conversational, helpful, and demonstrate that you remember context across the conversation.`;
