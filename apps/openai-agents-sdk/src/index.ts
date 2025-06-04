import { connectToMongoDB, closeMongoConnection, createConversation } from './db.js';
import { runAgentWithMemory } from './agent.js';
import { AppContext } from './types.js';
import 'dotenv/config';

// Make sure OPENAI_API_KEY is set
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

// Demo function to run the agent in a conversation
const runDemo = async (): Promise<void> => {
  // Connect to MongoDB
  const { client, db } = await connectToMongoDB();

  try {
    const userId = 'user-123';

    // Create a new conversation
    const conversationId = await createConversation(db, userId);

    // Create the AppContext
    const appContext: AppContext = {
      db,
      userId,
      conversationId,
      userProfile: { // In a real app, this would be fetched from the MongoDB database
        favoriteLanguage: 'TypeScript',
        favoriteDatabase: 'MongoDB',
        experience: 5,
        preferredFramework: 'Next.js'
      }
    };

    // First interaction
    console.log('=== Starting conversation ===');
    console.log('\nUser: What is the capital of France?');

    let result = await runAgentWithMemory('What is the capital of France?', appContext);
    console.log(`\nAssistant: ${result.finalOutput}`);

    // Second interaction (with memory)
    console.log('\nUser: What is its population?');
    result = await runAgentWithMemory('What is its population?', appContext);
    console.log(`\nAssistant: ${result.finalOutput}`);

    // Third interaction (with memory and using the tool)
    console.log('\nUser: What is my favorite programming language and database?');
    result = await runAgentWithMemory('What is my favorite programming language and database?', appContext);
    console.log(`\nAssistant: ${result.finalOutput}`);

    console.log('\n=== End of conversation ===');
  } catch (error) {
    console.error('Error running demo:', error);
  } finally {
    await closeMongoConnection(client);
  }
};

// Run the demo
runDemo().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
