# MongoDB Memory Agents with Vercel AI SDK v5

A Next.js 15 application demonstrating advanced AI chat with persistent memory management using MongoDB Atlas and Vercel AI SDK v5. Features intelligent memory operations, multi-model support (OpenAI/Gemini), and sophisticated memory distillation.

## Features

- **Multi-Model Support**: Automatic switching between OpenAI GPT and Google Gemini based on API key availability
- **Smart Memory System**: Intelligent memory operations (CREATE, UPDATE, MERGE, APPEND, IGNORE) with GPT-powered decision making
- **Four Memory Types**: Short-term (TTL), Long-term facts, Procedural knowledge, and Episodic experiences
- **Streaming Chat**: Real-time AI responses using Vercel AI SDK v5 with tool support
- **Memory Recall**: Contextual memory retrieval with semantic search before each response
- **Selective Memory Distillation**: Intelligent extraction of only significant user interactions, statements, and findings
- **Movie Tools**: Integrated movie search and recommendation tools
- **Memory Tracking**: Real-time memory operation visualization
- **Dark Mode UI**: Clean Tailwind CSS interface with modern components

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **AI SDK**: Vercel AI SDK v5 (@ai-sdk/openai, @ai-sdk/google, @ai-sdk/react)
- **Database**: MongoDB Atlas with native MongoDB drivers
- **Vector Search**: LangChain MongoDB Atlas Vector Search
- **Memory**: Custom smart memory system with GPT-powered decision making
- **Styling**: Tailwind CSS v4, Radix UI components
- **Validation**: Zod schemas

## Model Support

The application automatically selects the appropriate AI model based on available API keys:

- **With GOOGLE_API_KEY**: Uses Gemini 2.5 Flash for all operations
- **Without GOOGLE_API_KEY**: Uses OpenAI gpt-5-nano for chat and memory operations

## Environment Setup

**Required Environment Variables:**

Create a `.env.local` file or add to your deployment environment:

```env
# AI Model API Keys (at least one required)
# OpenAI API Key - Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key-here

# Google AI API Key (optional) - Get from: https://aistudio.google.com/app/apikey
# If provided, will use Gemini 2.5 Flash instead of OpenAI
GOOGLE_API_KEY=your-google-ai-api-key-here

# MongoDB Atlas Connection String - Required
# Get from: https://cloud.mongodb.com
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority"

# Optional: Database name (defaults to "mem_agent_memory")
MEMORY_DB=mem_agent_memory

# Optional: Collection name (defaults to "extracted_memories")
MEMORY_COLLECTION=extracted_memories

# Optional: OpenAI embedding model (defaults to "text-embedding-3-small")
EMBEDDING_MODEL=text-embedding-3-small
```

**Setup Steps:**

1. **AI API Keys**: 
   - **OpenAI**: Sign up at https://platform.openai.com and create an API key
   - **Google AI** (optional): Get API key from https://aistudio.google.com/app/apikey
   
2. **MongoDB Atlas**: 
   - Create a free cluster at https://cloud.mongodb.com
   - Get your connection string from the "Connect" button
   - Whitelist your IP address or use 0.0.0.0/0 for development

3. **Deploy**: Add environment variables to your deployment platform (Vercel, etc.)

## Installation

```bash
# Install dependencies
pnpm install

# Run development server
npm run dev
# or
pnpm dev
```

## MongoDB Atlas Vector Index Setup

The application requires vector search indexes on the following collections:

### Required Collections and Indexes

#### 1. Memory Collection (`extracted_memories`)
Create a vector search index on the memory collection (default: `extracted_memories` as specified in `.env example`):

1. Go to your MongoDB Atlas cluster
2. Navigate to "Search" → "Create Search Index"
3. Choose "JSON Editor" and use this configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    }
  ]
}
```

#### 2. Movies Collection (`sample_mfilx.embedded_movies`)
Create a vector search index on the pre-loaded movies collection:

1. Navigate to "Search" → "Create Search Index" 
2. Select the `sample_mfilx.embedded_movies` collection
3. Choose "JSON Editor" and use this configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "plot_embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

### Collection Details

- **Memory Collection**: Stores user memories with embeddings and user filtering capability
  - Database: `mem0_agent_memory` (configurable via `MEMORY_DB`)
  - Collection: `extracted_memories` (configurable via `MEMORY_COLLECTION`)
  - Vector Field: `embedding` (1536 dimensions)
  - Filter Field: `userId` for user-specific memory isolation

- **Movies Collection**: Pre-loaded movie data with plot embeddings for recommendations
  - Database: `sample_mfilx`
  - Collection: `embedded_movies`
  - Vector Field: `plot_embedding` (1536 dimensions)

## Memory System Architecture

### Memory Types

1. **Short-term Memory**: TTL-based conversation buffer (24h expiry)
2. **Long-term Memory**: Persistent facts, preferences, and knowledge
3. **Procedural Memory**: Step-by-step processes and instructions
4. **Episodic Memory**: Conversation summaries and experiences

### Smart Memory Operations

The system uses GPT-powered decision making to intelligently handle new memories:

- **CREATE**: Store completely new information
- **UPDATE**: Enhance existing memory with new details
- **MERGE**: Consolidate multiple related memories
- **APPEND**: Add information to existing memory
- **IGNORE**: Skip redundant or low-value information

### Memory Decision Process

1. **Semantic Search**: Find similar existing memories using vector similarity
2. **AI Decision**: GPT analyzes whether to create, update, merge, append, or ignore
3. **Execution**: Perform the decided operation with detailed reasoning
4. **Tracking**: Log all operations for transparency and debugging

## Key Components

### Core Architecture
- `app/api/chat/route.ts` - Main streaming chat API with model selection
- `lib/memory-mongodb.ts` - MongoDB Atlas vector store integration
- `lib/smart-memory.ts` - Intelligent memory management system
- `lib/memory-decision.ts` - GPT-powered memory decision service
- `lib/distill.ts` - Memory extraction and distillation logic

### UI Components
- `components/Chat.tsx` - Main chat interface
- `components/MemoryTracker.tsx` - Real-time memory operation display
- `components/MovieCard.tsx` - Movie recommendation display
- `hooks/use-memory-tracking.ts` - Memory operation state management

### Tools & Features
- `lib/movie-tools.ts` - Movie search and recommendation tools
- `lib/systemPrompt.ts` - Dynamic context-aware prompt building
- `lib/thread-storage.ts` - Short-term conversation storage

## Usage

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Start chatting - the AI will:
   - Remember context across sessions
   - Make intelligent decisions about what to remember
   - Provide movie recommendations when asked
   - Show memory operations in real-time
4. Check your MongoDB Atlas database to see stored memories and operations

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript checks

## Advanced Features

### Multi-Model Support
The application automatically detects available API keys and selects the best model:
- Gemini 2.5 Flash (if GOOGLE_API_KEY is available)
- OpenAI gpt-5-nano (fallback)

### Memory Intelligence
- Semantic similarity detection prevents duplicate memories
- Context-aware memory categorization
- Automatic memory consolidation and updates
- Confidence scoring for all memory operations

### Real-time Tracking
- Live memory operation display
- Detailed reasoning for each memory decision
- Success/failure tracking with error handling
- Memory type categorization visualization

## Database Schema

The system uses MongoDB collections with the following structure:

```typescript
// Memory Document
{
  _id: ObjectId,
  text: string,           // Memory content
  embedding: number[],    // Vector embedding (1536 dimensions)
  userId: string,         // User identifier
  type: 'long' | 'episodic' | 'procedural',
  timestamp: string,      // ISO date string
  metadata: {
    confidence: number,
    source: string,
    threadId?: string,
    action?: 'created' | 'updated' | 'merged' | 'appended',
    reasoning?: string
  }
}
```

## Contributing

This project demonstrates advanced AI memory management patterns and can be extended with:
- Additional AI model providers
- More sophisticated memory categorization
- Enhanced memory decay algorithms
- Advanced semantic search capabilities
- Custom memory visualization tools

## License

MIT License - feel free to use this as a foundation for your own AI memory applications.
