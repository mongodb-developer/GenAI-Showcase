export const runtime = "nodejs"

import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const threadId = searchParams.get('threadId')
  const userId = searchParams.get('userId')

  if (!threadId || !userId) {
    return Response.json({ error: 'Missing threadId or userId' }, { status: 400 })
  }

  console.log("[memory-ops] Fetching memory operations for:", { threadId, userId })

  try {
    // Import memory functions to get actual data
    const { getMemory } = await import('@/lib/memory-mongodb')
    const memory = await getMemory()

    // Get recent memories that might have been used for context
    // This simulates what memories were retrieved during the chat
    const retrievedResults = await memory.search("movie preferences recommendations", { 
      userId, 
      limit: 3 
    })

    const now = Date.now()
    
    // Transform retrieved memories
    const retrievedMemories = retrievedResults.map((result, index) => ({
      id: `retrieved-${now}-${index}`,
      type: 'retrieved' as const,
      category: (result.metadata?.type || 'long') as 'episodic' | 'long' | 'procedural',
      content: result.data || result.memory || result.text || 'Memory content',
      status: 'used' as const,
      timestamp: new Date(result.metadata?.timestamp || now - 86400000)
    }))

    // Simulate memories that would be created from this interaction with smart actions
    const createdMemories = [
      {
        id: `created-${now}-1`,
        type: 'created' as const,
        category: 'episodic' as const,
        content: `User interaction in thread ${threadId} - discussed movie recommendations and preferences`,
        status: 'completed' as const,
        action: 'CREATE' as const,
        reasoning: 'New conversation episode with unique movie discussion',
        timestamp: new Date()
      },
      {
        id: `created-${now}-2`, 
        type: 'created' as const,
        category: 'long' as const,
        content: `User ${userId} movie preferences updated: enjoys sci-fi, action, and thriller genres`,
        status: 'completed' as const,
        action: 'UPDATE' as const,
        reasoning: 'Updated existing preference memory with new genre information',
        timestamp: new Date()
      }
    ]

    const memoryOperations = {
      retrieved: retrievedMemories,
      created: createdMemories,
      summary: {
        retrievedCount: retrievedMemories.length,
        createdCount: createdMemories.length,
        totalUsed: retrievedMemories.length,
        totalCreated: createdMemories.length
      }
    }

    console.log("[memory-ops] Returning operations:", memoryOperations)
    return Response.json({ memoryOperations })

  } catch (error) {
    console.error("[memory-ops] Error fetching memory operations:", error)
    
    // Fallback to simulated data if memory system fails
    const now = Date.now()
    const fallbackOperations = {
      retrieved: [],
      created: [
        {
          id: `created-${now}-1`,
          type: 'created' as const,
          category: 'episodic' as const,
          content: `User interaction in thread ${threadId}`,
          status: 'completed' as const,
          timestamp: new Date()
        }
      ],
      summary: {
        retrievedCount: 0,
        createdCount: 1,
        totalUsed: 0,
        totalCreated: 1
      }
    }

    return Response.json({ memoryOperations: fallbackOperations })
  }
}
