import { createAgentUIStreamResponse } from "ai";
import { agent } from "@/lib/agent";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  console.log(`\n${"=".repeat(50)}`);
  console.log(`💬 New message received`);
  console.log(`${"=".repeat(50)}`);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
  });
}
