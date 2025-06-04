import { Agent, run } from '@openai/agents';
import { addToConversationHistory, createConversation, getConversationHistory } from './db.js';
import { AgentRunResult, ConversationEntry } from './types.js';

// Format conversation history for the agent
const formatConversationHistory = (history: ConversationEntry[]): string => {
  return history
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join('\n\n');
};

// Run the agent with conversation memory
export const runAgentWithMemory = async (
  input: string,
  userId: string,
  conversationId?: string
): Promise<AgentRunResult> => {
  // Create conversation if it doesn't exist
  const currentConversationId = conversationId || await createConversation(userId);

  // Store the user's message
  await addToConversationHistory(currentConversationId, 'user', input);

  // Get conversation history
  const history = await getConversationHistory(currentConversationId);

  // Create agent with the conversation history as context
  const agent = new Agent({
    name: 'Assistant with Memory',
    model: 'gpt-4o-mini',
    instructions: `
      You are a helpful assistant with memory of past conversations.

      Previous conversation:
      ${formatConversationHistory(history)}
    `,
  });

  // Run the agent
  const result = await run(agent, input);

  // Store the agent's response
  if (result.finalOutput) {
    await addToConversationHistory(currentConversationId, 'assistant', result.finalOutput);
  }

  return {
    conversationId: currentConversationId,
    finalOutput: result.finalOutput || '',
  };
};
