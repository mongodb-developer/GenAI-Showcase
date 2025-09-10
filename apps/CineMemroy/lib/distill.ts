import { generateObject } from "ai"
import { z } from "zod"

const DistillSchema = z.object({
  facts: z.array(z.string()).optional(),
  procedures: z
    .array(
      z.object({
        title: z.string(),
        steps: z.array(z.string().min(1)),
      }),
    )
    .optional(),
  episode: z.string().optional(),
})

interface DistillInput {
  lastUser: { role: string; content: string }
  reply: string
  model: any
}

export async function distill({ lastUser, reply, model }: DistillInput) {
  const { object } = await generateObject({
    model: model,
    schema: DistillSchema,
    prompt: `You are a memory curator for an AI assistant. Your role is to identify significant user interactions, statements, and findings that deserve to be remembered for future conversations.

Analyze this conversation turn:

User: ${lastUser.content}
Assistant: ${reply}

Extract information ONLY when it represents significant user interactions or findings:

- facts: Extract ONLY when users share concrete personal information, permanent constraints, or major preference discoveries (e.g., "I'm a film student", "I have visual impairments", "I only watch subtitled films", "I discovered I love documentaries after never watching them"). Skip ALL casual opinions, mood-based requests, genre preferences, or routine movie discussions.

- procedures: Extract when users explicitly ask for step-by-step guidance and you provide detailed instructions they may need to reference later (e.g., setting up equipment, finding specific content, troubleshooting processes). Skip general advice or simple recommendations.

- episode: Extract ONLY major discoveries, life changes, or significant preference shifts (e.g., "User mentioned becoming a parent changed viewing habits", "User discovered they love foreign films after years of avoiding them"). Skip ALL routine interactions, casual movie discussions, recommendation requests, or minor preference mentions.

Guidelines:
- Focus on information that would improve future assistance to this user
- Omit general conversations, casual preferences, or temporary interests
- Extract findings and insights that emerged from the interaction
- Only store what would be genuinely useful to remember about this specific user
- Most routine conversations should result in no extractions

If nothing significant occurred in this interaction, return empty/undefined values.`,
  })

  return object
}
