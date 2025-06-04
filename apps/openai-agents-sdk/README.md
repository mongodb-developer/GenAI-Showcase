# OpenAI Agents SDK with MongoDB Memory

This demo app shows how to use the [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) with [MongoDB](https://www.mongodb.com/cloud/atlas/register/?utm_campaign=devrel&utm_source=third-party-content&utm_medium=cta&utm_content=openai-agents-sdk-template&utm_term=jesse.hall) for persistent conversation history.

## Key Features

- Uses MongoDB to store conversation history
- Leverages the SDK's built-in message handling capabilities
- Custom tool to access user profile information
- Simple implementation for educational purposes

## Getting Started

1. Make sure MongoDB is set up and running

2. Create a `.env` file with:
   ```
   MONGODB_URI=mongodb://localhost:27017/agent_memory
   OPENAI_API_KEY=your_openai_api_key
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the TypeScript:
   ```bash
   npm run build
   ```

5. Run the demo:
   ```bash
   npm start
   ```

## How It Works

The demo shows a hybrid approach to conversation memory:

1. **MongoDB for Persistence**: Messages are saved to MongoDB so they persist across server restarts
2. **SDK's Message Handling**: We use the SDK's built-in `user()` and `assistant()` functions to format message history
3. **Context-Aware Tools**: Custom tools can access application context including user profiles
4. **Simple Interface**: Clean implementation with minimal code

## Demo Conversation

The demo runs a simple conversation that demonstrates:
1. Basic question answering
2. Memory of previous questions (asking about "its population" after asking about France)
3. Using a tool to fetch user profile information

## Project Structure

- `src/db.ts`: MongoDB connection and conversation storage functions
- `src/agent.ts`: OpenAI Agents SDK implementation with custom tools
- `src/types.ts`: TypeScript type definitions for conversations and context
- `src/index.ts`: Demo script that runs a sample conversation

## License

MIT
