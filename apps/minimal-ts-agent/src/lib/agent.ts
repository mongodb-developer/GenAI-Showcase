import { ToolLoopAgent, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { searchDocumentation } from "./tools";

// ============================================================
// The ToolLoopAgent — the core of our RAG agent
// ============================================================
// Unlike a standard generateText() call, this agent enters a "loop."
// It looks at your tools, decides if it needs them, runs them,
// and repeats until the task is finished.
// ============================================================

export const agent = new ToolLoopAgent({
  // The LLM that powers our agent
  model: google("gemini-flash-latest"),

  // System prompt — defines the agent's personality and boundaries
  instructions: `You are a MongoDB Brand Expert — an AI assistant that helps people understand and apply the MongoDB brand guidelines.

Your knowledge comes from the official MongoDB Brand Book (Tone of Voice edition). When users ask about how MongoDB should sound, write, or present itself, you MUST use the searchDocumentation tool to find the relevant sections before answering.

Guidelines for your responses:
- Always search the brand book before answering brand-related questions
- Quote specific examples from the brand book when available
- Be straightforward and direct (following MongoDB's own tone of voice!)
- If the brand book doesn't cover a topic, say so honestly
- Format your responses with clear headings and bullet points when appropriate
- Keep responses concise but comprehensive`,

  // The tools the agent can use
  tools: {
    searchDocumentation,
  },

  // Safety net: max 10 steps to prevent infinite loops
  stopWhen: stepCountIs(10),

  // Log each step for demo visibility
  onStepFinish({ text, toolCalls, toolResults }) {
    if (toolCalls && toolCalls.length > 0) {
      console.log(`\n🤖 Agent step: called ${toolCalls.length} tool(s)`);
    }
    if (text) {
      console.log(`\n🤖 Agent step: generating response (${text.length} chars)`);
    }
  },
});

// Export the agent for use in API routes
export type { ToolLoopAgent };
