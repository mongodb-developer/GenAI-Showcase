# Voice Memory Demo

A Next.js demo showcasing persistent memory for voice AI agents using **Gemini Live** and **MongoDB**.

Based on the article: [Building Persistent Memory for Voice AI Agents with MongoDB](https://dev.to/mongodb/building-persistent-memory-for-voice-ai-agents-with-mongodb-1obe)

## Features

- 🎙️ **Real-time Voice Interaction** - WebSocket-based voice communication with Gemini Live
- 🧠 **Persistent Memory** - Store and retrieve memories across sessions using MongoDB
- 🔧 **Memory as Tool** - AI decides when to store/retrieve information (not hardcoded rules)
- 🔒 **User Isolation** - Each browser gets a unique ID for privacy
- 🌐 **Global vs Private** - Gemini classifies memories and obfuscates PII in shared data

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Browser           │     │   Gemini Live API    │
│   - Mic capture     │◄───►│   WebSocket          │
│   - Audio playback  │     │   gemini-live-2.5-   │
│   - UI              │     │   flash-native-audio │
└─────────────────────┘     └──────────────────────┘
         │
         │ Tool Calls
         ▼
┌─────────────────────┐     ┌──────────────────────┐
│   Next.js API       │────►│   MongoDB Atlas      │
│   /api/memory       │     │   memories collection│
└─────────────────────┘     └──────────────────────┘
```

## Quick Start

### 1. Clone and Install

```bash
cd voice-memory-demo
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```env
GOOGLE_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb+srv://...
MONGODB_DB=voice_memory_demo
VOYAGE_AI_API_KEY=your_voyage_ai_key
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Create MongoDB Indexes

For hybrid search (vector + text) with `$rankFusion` (require latest Atlas version cluster), the code creates on startup two MongoDB Search indexes on the `memories` collection:

#### Vector Search Index

**Index Name:** `memory_vector_index`

Optional: In Atlas UI: **Search Indexes** → **Create Search Index** → **MongoDB Vector Search**

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "deploymentId"
    },
    {
      "type": "filter",
      "path": "userCookie"
    },
    {
      "type": "filter",
      "path": "isGlobal"
    }
  ]
}
```

#### MongoDB Search Index (Text)

**Index Name:** `memory_text_index`

Optional: In Atlas UI: **Search Indexes** → **Create Search Index** → **MongoDB Search**

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "key": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "value": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "deploymentId": {
        "type": "string"
      },
      "userCookie": {
        "type": "string"
      },
      "isGlobal": {
        "type": "boolean"
      }
    }
  }
}
```

> **Note:** If you don't set up these indexes, the app will fall back to regex-based search which is less accurate for semantic queries.

## How It Works

### Memory Tool

The AI agent has access to an `agentMemory` tool with four operations:

| Operation | Description | Example |
|-----------|-------------|---------|
| `set` | Store a key-value pair | `{op: "set", key: "user_name", value: "Pavel"}` |
| `get` | Retrieve by key | `{op: "get", key: "user_name"}` |
| `delete` | Remove a memory | `{op: "delete", key: "user_name"}` |
| `query` | Search memories | `{op: "query", query: "user preferences"}` |

### Memory Classification

When storing a memory, Gemini classifies it:
- **Private**: User-specific data (name, preferences, contact info)
- **Global**: Shared facts (business hours, product info, policies)

Global memories have PII obfuscated (emails → `[EMAIL]`, phones → `[PHONE]`).

### User Isolation

Each browser generates a UUID stored in localStorage:
- Private memories are scoped to this ID
- Global memories are accessible to everyone
- Users can reset their identity from the UI

## File Structure

```
voice-memory-demo/
├── src/
│   ├── app/
│   │   ├── api/memory/route.ts   # Memory API endpoint
│   │   ├── page.tsx              # Main page
│   │   ├── layout.tsx            # App layout
│   │   └── globals.css           # Styles
│   ├── components/
│   │   ├── VoiceAgent.tsx        # Main voice interface
│   │   └── MemoryPanel.tsx       # Memory debug panel
│   ├── hooks/
│   │   ├── useGeminiLive.ts      # Gemini WebSocket hook
│   │   └── useUserCookie.ts      # User ID management
│   └── lib/
│       ├── mongodb.ts            # MongoDB connection
│       ├── memory-service.ts     # Memory CRUD operations
│       └── gemini-tools.ts       # Tool definitions
├── public/
│   └── audio-processor.js        # AudioWorklet for mic capture
└── .env.local.example            # Environment template
```

## Try These Prompts

After connecting, try saying:

- "My name is [your name]"
- "I live in [city]"
- "I prefer email over phone calls"
- "What do you remember about me?"
- "What's my name?"
- "Forget my name"

## Technical Details

### Audio Format

- **Input**: PCM 16-bit, 16kHz, mono
- **Output**: PCM 16-bit, 24kHz, mono

### Model

Using `gemini-2.5-flash-native-audio-preview-12-2025` for real-time voice-to-voice interaction with tool calling support.

### MongoDB Schema

```javascript
{
  deploymentId: "voice-memory-demo",
  key: "user_name",
  value: "Pavel",
  userCookie: "uuid-xxx" | "global",
  isGlobal: false,
  embedding: [0.123, -0.456, ...],  // 1024-dim VoyageAI vector (if enabled)
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

## Troubleshooting

### "WebSocket connection error"
- Check your `GOOGLE_API_KEY` is valid
- Ensure you have access to the Gemini Live API

### No audio playback
- Check browser permissions for audio
- Try clicking the page first (browsers require user interaction)

### Memory not saving
- Verify `MONGODB_URI` is correct
- Check MongoDB network access (IP whitelist)

## License

MIT
