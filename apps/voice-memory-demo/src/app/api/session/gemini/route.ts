import { NextResponse, type NextRequest } from "next/server";
import { Type } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const { deploymentId, userCookie } = await request.json();

    if (!deploymentId) {
      return NextResponse.json({ error: "deploymentId is required" }, { status: 400 });
    }

    // Check for Google API key
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_API_KEY environment variable is not set");
      return NextResponse.json({ error: "Google API key is not configured" }, { status: 500 });
    }

    // Build system instructions
    let systemInstructions = `You are a helpful voice assistant with persistent memory capabilities.

### CURRENT_DATE (UTC) ###
${new Date().toUTCString()}

### CAPABILITIES ###
You can perform the following tasks:
- Store information about the user using the agentMemory tool
- Retrieve previously stored information
- Search through stored memories
- Delete memories when asked

### INSTRUCTIONS ###
IMPORTANT: You have access to the agentMemory tool to store and retrieve information across conversations.

When to use memory:
1. When the user shares personal information (name, location, preferences), USE agentMemory with operation "set" to store it
2. When you need to recall something about the user, USE agentMemory with operation "query" or "get"
3. When the user asks you to forget something, USE agentMemory with operation "delete"

Memory key naming conventions:
- user_name: The user's name
- user_location: Where the user lives/works
- user_preference_[topic]: User preferences (e.g., user_preference_communication)
- user_[category]: Other user-specific info

Always confirm when you've remembered something: "I'll remember that..." or "Got it, I've noted that..."
When recalling: "Based on what I remember..." or "You mentioned before that..."

Be conversational, helpful, and demonstrate that you remember context across the conversation.

IMPORTANT: You are in a voice conversation. Speak naturally and conversationally. Be concise and clear in your responses. Start by greeting the user warmly.`;

    // Build the agentMemory tool declaration
    const memoryToolFunctionDeclaration = {
      name: 'agentMemory',
      description: 'Store and retrieve memories about the user and conversation. Use this to remember important information shared by the user (like their name, preferences, location, or other facts) and to recall previously stored information. ALWAYS use this tool when the user shares personal information.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          operation: {
            type: Type.STRING,
            enum: ['get', 'set', 'delete', 'query'],
            description: 'The operation to perform: "set" to store a memory, "get" to retrieve by exact key, "query" to search memories by natural language, "delete" to remove a memory',
          },
          key: {
            type: Type.STRING,
            description: 'Memory key identifier (required for get/set/delete). Use descriptive keys like "user_name", "user_location", "user_preference_communication"',
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

    // Build session config
    const config = {
      responseModalities: ["AUDIO"],
      systemInstruction: systemInstructions,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Puck',
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: [memoryToolFunctionDeclaration] }],
    };

    const sessionConfig = {
      apiKey,
      model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
      config,
      deployment: {
        id: deploymentId,
        name: "Voice Memory Demo",
        description: "A voice agent with persistent memory",
      },
      userCookie,
    };

    console.log(`[Gemini Session] Created session for deployment ${deploymentId}`);

    return NextResponse.json(sessionConfig);
  } catch (error) {
    console.error("Error in /api/session/gemini:", error);
    return NextResponse.json({ error: "Failed to create Gemini voice session." }, { status: 500 });
  }
}
