export const runtime = "nodejs"

import { streamText, convertToModelMessages, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai"
import { getMemory } from "@/lib/memory-mongodb"
import { saveTurns, getRecent, getThreadStorage } from "@/lib/thread-storage"
import { buildSystemPrompt } from "@/lib/systemPrompt"
import { distill } from "@/lib/distill"
import { movieTools } from "@/lib/movie-tools"
import { getSmartMemoryService, type MemoryOperationResult } from "@/lib/smart-memory"
import { getChatModel, getModelInfo } from "@/lib/model-factory"

export async function POST(req: Request) {
  console.log("[v0] API route called")
  console.log("[v0] Request URL:", req.url)
  console.log("[v0] Request headers:", Object.fromEntries(req.headers.entries()))

  try {
    const body = await req.json()
    console.log("[v0] Request body:", JSON.stringify(body, null, 2))

    const { messages, userId = "anon", threadId } = body
    
    console.log("[v0] Extracted userId from request:", userId)
    console.log("[v0] UserId type:", typeof userId)
    console.log("[v0] Extracted threadId from request:", threadId)
    
    // Use client-provided threadId or generate one as fallback
    const finalThreadId = threadId || `session-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log("[v0] Final threadId being used:", finalThreadId)

    if (!messages || !Array.isArray(messages)) {
      console.log("[v0] Invalid messages format")
      return new Response("Invalid messages format", { status: 400 })
    }

    console.log("[v0] Getting memory instance")
    let memory: any
    try {
      memory = await getMemory()
      console.log("[v0] Memory instance obtained successfully")
    } catch (error) {
      console.error("[v0] Failed to get memory instance:", error)
      throw error
    }

    const lastUserMessage = messages[messages.length - 1]

    const getMessageContent = (message: any): string => {
      if (message.content) return message.content
      if (message.parts && Array.isArray(message.parts)) {
        return message.parts.map((part: any) => part.text || part.content || "").join(" ")
      }
      return "general"
    }

    const query = getMessageContent(lastUserMessage)
    console.log("[v0] Extracted query:", query)

    console.log("[v0] Getting recent turns for user:", userId, "thread:", finalThreadId)
    let recentTurns: any[] = []
    try {
      recentTurns = await getRecent(userId, 6, finalThreadId)
      console.log("[v0] Recent turns retrieved:", recentTurns.length)
    } catch (error) {
      console.error("[v0] Error getting recent turns:", error)
      recentTurns = []
    }

    const fallbackTurns = messages.slice(-4)
    const contextTurns = recentTurns.length > 0 ? recentTurns : fallbackTurns

    console.log("[v0] Searching memories")
    let longResults: any[] = []
    let proceduralResults: any[] = []
    let episodicResults: any[] = []

    try {
      console.log("[v0] Searching long-term memories...")
      longResults = await memory.search(query, { userId, limit: 6 })
      console.log("[v0] Long-term results:", longResults.length)
    } catch (error) {
      console.error("[v0] Error searching long-term memories:", error)
      longResults = []
    }

    try {
      if (/\b(how|steps?|guide|procedure|install|configure|setup)\b/i.test(query)) {
        console.log("[v0] Searching procedural memories...")
        proceduralResults = await memory.search(query, { userId, limit: 4 })
        console.log("[v0] Procedural results:", proceduralResults.length)
      }
    } catch (error) {
      console.error("[v0] Error searching procedural memories:", error)
      proceduralResults = []
    }

    try {
      console.log("[v0] Searching episodic memories...")
      episodicResults = await memory.search(query, { userId, limit: 4 })
      console.log("[v0] Episodic results:", episodicResults.length)
    } catch (error) {
      console.error("[v0] Error searching episodic memories:", error)
      episodicResults = []
    }

    // Convert results to strings (defensive extraction)
    const longFacts = longResults
      .map((r: any) => r.data || r.memory || r.text || r.payload?.data || JSON.stringify(r))
      .filter(Boolean)

    const procedures = proceduralResults
      .map((r: any) => r.data || r.memory || r.text || r.payload?.data || JSON.stringify(r))
      .filter(Boolean)

    // Filter episodic to last 60 days (post-filter if server-side not available)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const episodes = episodicResults
      .filter((r: any) => {
        const occurredAt = r.metadata?.occurred_at
        return !occurredAt || new Date(occurredAt) > sixtyDaysAgo
      })
      .map((r: any) => r.data || r.memory || r.text || r.payload?.data || JSON.stringify(r))
      .filter(Boolean)

    // Build system prompt
    const system = buildSystemPrompt({
      recentTurns: contextTurns,
      longFacts: longFacts.length > 0 ? longFacts : undefined,
      procedures: procedures.length > 0 ? procedures : undefined,
      episodes: episodes.length > 0 ? episodes : undefined,
    })

    // Get cached model from factory
    const selectedModel = getChatModel()
    const modelInfo = getModelInfo()
    
    console.log(`[v0] Starting stream with ${modelInfo.provider}`)
    console.log(`[v0] Selected model: ${modelInfo.model}`)
    
    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages)
    
    // Stream response with movie tools
    const result = streamText({
      model: selectedModel,
      messages: modelMessages,
      system,
      tools: movieTools,
      stopWhen: stepCountIs(5), // Allow multi-step generation after tool calls
      onFinish: async ({ text, toolCalls, toolResults }) => {
        console.log("[v0] Stream finished with tool calls:", toolCalls?.length || 0)
        console.log("[v0] Tool results:", toolResults?.length || 0)
        console.log("[v0] Final text output length:", text?.length || 0)
        console.log("[v0] Final text output:", text || "NO TEXT OUTPUT")
        
        // Log any tool errors and successful results
        if (toolResults) {
          toolResults.forEach((toolResult) => {
            console.log(`[v0] Tool ${toolResult.toolName} result:`, JSON.stringify(toolResult.output, null, 2))
            
            // Check if the tool result indicates an error
            if (toolResult.output && typeof toolResult.output === 'object' && 'success' in toolResult.output && !toolResult.output.success) {
              const errorOutput = toolResult.output as any
              console.error(`[v0] Tool ${toolResult.toolName} failed:`, errorOutput.error)
            } else {
              console.log(`[v0] Tool ${toolResult.toolName} succeeded`)
            }
          })
        }
        
        console.log("[v0] Stream finished, processing memories")
        try {
          const userContent = getMessageContent(messages[messages.length - 1])

          // 1) Store raw turns in short-term with TTL
          try {
            await saveTurns(userId, [
              { role: "user", content: userContent },
              { role: "assistant", content: text },
            ], finalThreadId)
          } catch (error) {
            console.error("Error saving turns to thread storage:", error)
            // Continue with memory operations even if thread storage fails
          }

          // 2) Distill and store memories using smart memory service
          // Skip memory processing for simple movie requests to prevent loops
          const isSimpleMovieRequest = /^(find|show|get|recommend|suggest).*(movie|film)/i.test(userContent) && userContent.length < 100
          
          if (isSimpleMovieRequest) {
            console.log("[v0] Skipping memory processing for simple movie request")
            return
          }
          
          const distilled = await distill({
            lastUser: { role: "user", content: userContent },
            reply: text,
            model: selectedModel,
          })

          // Get smart memory service
          const smartMemory = getSmartMemoryService()

          // Track memory operations for frontend
          const memoryOperations: Array<{
            type: 'episodic' | 'long' | 'procedural';
            content: string;
            success: boolean;
            action?: string;
            reasoning?: string;
            error?: string;
          }> = []

          // Store episodic memory using smart memory service
          if (distilled.episode) {
            try {
              const result = await smartMemory.addSmartMemory(
                distilled.episode,
                'episodic',
                {
                  userId,
                  metadata: {
                    occurred_at: new Date().toISOString(),
                    source: "vercel-ai-sdk",
                    threadId: finalThreadId,
                  },
                }
              )
              
              memoryOperations.push({
                type: 'episodic',
                content: result.content,
                success: true,
                action: result.action,
                reasoning: result.reasoning
              })
            } catch (error) {
              console.error("Error storing episodic memory:", error)
              memoryOperations.push({
                type: 'episodic',
                content: distilled.episode,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          // Store facts using smart memory service
          for (const fact of distilled.facts ?? []) {
            try {
              const result = await smartMemory.addSmartMemory(
                fact,
                'long',
                {
                  userId,
                  metadata: {
                    confidence: 0.8,
                    threadId: finalThreadId,
                  },
                }
              )
              
              memoryOperations.push({
                type: 'long',
                content: result.content,
                success: true,
                action: result.action,
                reasoning: result.reasoning
              })
            } catch (error) {
              console.error("Error storing fact:", error)
              memoryOperations.push({
                type: 'long',
                content: fact,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          // Store procedures using smart memory service
          for (const proc of distilled.procedures ?? []) {
            const doc = `${proc.title}\n${proc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
            try {
              const result = await smartMemory.addSmartMemory(
                doc,
                'procedural',
                {
                  userId,
                  metadata: {
                    title: proc.title,
                    threadId: finalThreadId,
                  },
                }
              )
              
              memoryOperations.push({
                type: 'procedural',
                content: result.content,
                success: true,
                action: result.action,
                reasoning: result.reasoning
              })
            } catch (error) {
              console.error("Error storing procedure:", error)
              memoryOperations.push({
                type: 'procedural',
                content: doc,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          }

          // Log memory operations for debugging
          console.log("[v0] Memory operations completed:", memoryOperations)

        } catch (error) {
          console.error("Error in onFinish:", error)
        }
      },
      onError: ({ error }) => {
        console.error("[v0] Stream error:", error)
      },
    })

    console.log("[v0] Returning stream response for thread:", finalThreadId)
    
    // Add threadId to response headers so client can track the thread
    const response = result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("[v0] Error in stream response:", error)
        
        // Handle different types of errors and return user-friendly messages
        if (error && typeof error === 'object') {
          if ('name' in error) {
            switch (error.name) {
              case 'NoSuchToolError':
                return 'The AI tried to use an unknown tool. Please try again.'
              case 'InvalidToolArgumentsError':
                return 'The AI provided invalid arguments to a tool. Please rephrase your request.'
              case 'ToolExecutionError':
                return 'A tool failed to execute properly. Please try again or rephrase your request.'
              default:
                break
            }
          }
          
          // Check if it's a tool result error
          if ('success' in error && !error.success && 'error' in error) {
            return `Movie search error: ${error.error}`
          }
        }
        
        // Generic error message for unknown errors
        if (error instanceof Error) {
          console.error("[v0] Error details:", error.message, error.stack)
          return `An error occurred: ${error.message}`
        }
        
        return 'An unexpected error occurred. Please try again.'
      }
    })
    
    response.headers.set('X-Thread-ID', finalThreadId)
    
    return response
  } catch (error) {
    console.error("[v0] API route error:", error)
    console.error("[v0] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return new Response("Internal server error. Please check your environment variables.", {
      status: 500,
    })
  }
}
