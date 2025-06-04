# OpenAI Agents SDK with MongoDB Memory Template

A simple demonstration of using the [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) with [MongoDB](https://www.mongodb.com/cloud/atlas/register/?utm_campaign=devrel&utm_source=third-party-content&utm_medium=cta&utm_content=openai-agents-sdk-template&utm_term=jesse.hall) as a memory store for conversation history.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the example environment file:
   ```
   cp .env.example .env
   ```
4. Set up your environment variables in `.env`:
   ```
   MONGODB_URI=your_mongodb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   ```

## Running the Demo

Build the project:

```bash
npm run build
```

Run the demo with:

```bash
npm start
```

Or use the development mode with automatic reloading:

```bash
npm run dev
```

## How it Works

The demo shows a simple conversation with an agent that maintains memory across multiple interactions:

1. User asks about the capital of France
2. User asks about its population (agent remembers "its" refers to Paris)
3. User asks about landmarks there (agent still remembers the context is about Paris)

## Project Structure

- `src/types.ts`: TypeScript type definitions
- `src/db.ts`: MongoDB connection and data access functions
- `src/agent.ts`: Agent implementation with memory integration
- `src/index.ts`: Main demo script
