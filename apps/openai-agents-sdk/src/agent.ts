import { Agent, run, user, assistant, tool, RunContext } from '@openai/agents';
import { z } from 'zod';
import { addToConversationHistory, getConversationHistory } from './db.js';
import { AgentRunResult, AppContext } from './types.js';

// Simple tool that can access the context directly
const getUserInfoTool = tool({
  name: 'get_user_info',
  description: 'Get detailed information about the current user including their profile',
  parameters: z.object({}),
  execute: async (_args, runContext?: RunContext<AppContext>): Promise<string> => {
    if (!runContext?.context) {
      return "No context available";
    }

    const context = runContext.context;

    // Build a detailed response that includes all available user information
    let response = `User ID: ${context.userId}\nConversation ID: ${context.conversationId || 'unknown'}`;

    // Add profile information if available
    if (context.userProfile) {
      response += `\n\nUser Profile:`;
      response += `\n- Favorite Programming Language: ${context.userProfile.favoriteLanguage}`;
      response += `\n- Favorite Database: ${context.userProfile.favoriteDatabase}`;
      response += `\n- Years of Experience: ${context.userProfile.experience}`;

      if (context.userProfile.preferredFramework) {
        response += `\n- Preferred Framework: ${context.userProfile.preferredFramework}`;
      }
    }

    return response;
  },
});

// Run the agent with conversation memory
export const runAgentWithMemory = async (
  input: string,
  context: AppContext
): Promise<AgentRunResult> => {
  const { db, conversationId } = context;

  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }

  // Add the current user message to the database
  await addToConversationHistory(db, conversationId, 'user', input);

  // Create agent with dynamic instructions based on context
  const agent = new Agent<AppContext>({
    name: 'Assistant with Memory',
    model: 'gpt-4o-mini',
    instructions: (runContext: RunContext<AppContext>) =>
      `You are a helpful assistant with memory of past conversations for user ${runContext.context.userId}.
       You can access user information if needed using the get_user_info tool.
       When asked to use the get_user_info tool, please call the tool and display ALL the information it returns verbatim.`,
    tools: [getUserInfoTool],
  });

  // Get past conversation history from database
  const history = await getConversationHistory(db, conversationId);

  // Convert database history to agent message format
  const agentMessages = history.map(entry =>
    entry.role === 'user' ? user(entry.content) : assistant(entry.content)
  );

  // Run the agent with the conversation history and context
  const result = await run(agent, agentMessages, { context });

  // Store the assistant's response in the database
  if (result.finalOutput) {
    await addToConversationHistory(db, conversationId, 'assistant', result.finalOutput);
  }

  return {
    conversationId,
    finalOutput: result.finalOutput || '',
  };
};
