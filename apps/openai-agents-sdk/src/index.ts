import { closeMongoConnection } from './db.js';
import { runAgentWithMemory } from './agent.js';
import 'dotenv/config';

// Make sure OPENAI_API_KEY is set
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

// Demo function to run the agent in a conversation
const runDemo = async (): Promise<void> => {
  try {
    const userId = 'user-123'; // In a real app, this would be a real user ID
    let conversationId: string | undefined;

    // First interaction
    console.log('=== Starting conversation ===');
    console.log('\nUser: What is the capital of France?');

    const result1 = await runAgentWithMemory(
      'What is the capital of France?',
      userId
    );

    conversationId = result1.conversationId;
    console.log(`\nAssistant: ${result1.finalOutput}`);

    // Second interaction (with memory)
    console.log('\nUser: What is its population?');

    const result2 = await runAgentWithMemory(
      'What is its population?',
      userId,
      conversationId
    );

    console.log(`\nAssistant: ${result2.finalOutput}`);

    // Third interaction (with memory)
    console.log('\nUser: What are some famous landmarks there?');

    const result3 = await runAgentWithMemory(
      'What are some famous landmarks there?',
      userId,
      conversationId
    );

    console.log(`\nAssistant: ${result3.finalOutput}`);

    console.log('\n=== End of conversation ===');
  } catch (error) {
    console.error('Error running demo:', error);
  } finally {
    // Close MongoDB connection when done
    await closeMongoConnection();
    process.exit(0);
  }
};

// Run the demo
runDemo().catch((error) => {
  console.error('Unhandled error:', error);
  closeMongoConnection().finally(() => {
    process.exit(1);
  });
});
