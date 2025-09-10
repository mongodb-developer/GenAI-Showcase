export const runtime = "nodejs"

import { generateText } from "ai"
import { getMemory } from "@/lib/memory-mongodb"
import { getChatModel, getModelInfo } from "@/lib/model-factory"

export async function POST(req: Request) {
  console.log("[Greeting] API route called")

  try {
    const body = await req.json()
    const { userId } = body

    if (!userId) {
      return new Response("userId is required", { status: 400 })
    }

    console.log("[Greeting] Generating greeting for user:", userId)

    // Get memory instance
    const memory = await getMemory()

    // Search for user's memories to create personalized greeting
    const userMemories = await memory.search("", { userId, limit: 10 })
    
    if (!userMemories || userMemories.length === 0) {
      // No memories found, return a generic greeting
      return Response.json({
        greeting: "Welcome! I'm your movie recommendation assistant. What kind of films are you in the mood for today?"
      })
    }

    // Extract memory content
    const memoryContent = userMemories
      .map((r: any) => r.data || r.memory || r.text || "")
      .filter(Boolean)
      .slice(0, 5) // Use top 5 most relevant memories

    // Get cached model from factory
    const selectedModel = getChatModel()

    // Generate personalized greeting
    const { text } = await generateText({
      model: selectedModel,
      prompt: `You are a movie recommendation assistant greeting a returning user. Based on their memory context below, create a warm, personalized greeting message (1-2 sentences max) that shows you remember something meaningful about them.

User's Memory Context:
${memoryContent.join('\n')}

Guidelines:
- Keep it brief and natural (1-2 sentences)
- Reference something specific you remember about their preferences, interests, or past discoveries
- Make it conversational and welcoming
- Don't repeat memory content verbatim
- Focus on what would be most relevant for movie recommendations

Example good greetings:
- "Welcome back! I remember you've been exploring Korean cinema lately - ready to discover more hidden gems?"
- "Hi again! Since you mentioned loving sci-fi with deep themes, I've been thinking of some perfect recommendations for you."
- "Good to see you! I recall you're a film student - shall we dive into some cinematically rich films today?"

Generate a personalized greeting:`,
      temperature: 0.7
    })

    console.log("[Greeting] Generated greeting:", text)

    return Response.json({
      greeting: text.trim()
    })

  } catch (error) {
    console.error("[Greeting] Error generating greeting:", error)
    
    // Fallback to generic greeting
    return Response.json({
      greeting: "Welcome back! What movies are you interested in exploring today?"
    })
  }
}
