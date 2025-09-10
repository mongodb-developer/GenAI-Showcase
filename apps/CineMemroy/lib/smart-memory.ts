import { getMemory } from './memory-mongodb'
import { getMemoryDecisionService, type MemoryDecision } from './memory-decision'

// Import the CustomMemory type from memory-mongodb
type CustomMemory = Awaited<ReturnType<typeof getMemory>>

interface SmartMemoryOptions {
  userId: string
  metadata?: Record<string, any>
}

interface MemoryOperationResult {
  action: 'UPDATE' | 'MERGE' | 'APPEND' | 'CREATE' | 'IGNORE'
  memoryId?: string
  content: string
  reasoning: string
  confidence: number
  existingMemoriesUsed?: number
}

export class SmartMemoryService {
  private memory: Promise<CustomMemory> | null = null
  private decisionService = getMemoryDecisionService()

  private async getMemoryInstance() {
    if (!this.memory) {
      this.memory = getMemory()
    }
    return await this.memory
  }

  /**
   * Smart memory addition with update/merge logic
   */
  async addSmartMemory(
    content: string,
    memoryType: 'episodic' | 'long' | 'procedural',
    options: SmartMemoryOptions
  ): Promise<MemoryOperationResult> {
    console.log("[SmartMemory] Processing memory:", { memoryType, userId: options.userId })

    try {
      // Step 1: Search for similar existing memories
      const similarMemories = await this.findSimilarMemories(content, memoryType, options.userId)
      
      console.log("[SmartMemory] Found similar memories:", similarMemories.length)

      // Step 2: Use GPT-4.1-nano to decide what to do
      const decision = await this.decisionService.decideMemoryAction({
        newMemory: content,
        memoryType,
        existingMemories: similarMemories,
        userId: options.userId
      })

      console.log("[SmartMemory] Decision:", decision)

      // Step 3: Execute the decision
      const result = await this.executeDecision(decision, content, memoryType, options)
      
      return result

    } catch (error) {
      console.error("[SmartMemory] Error in smart memory processing:", error)
      
      // Fallback: create new memory
      const memory = await this.getMemoryInstance()
      await memory.add([{ role: 'system', content }], options)
      
      return {
        action: 'CREATE',
        content,
        reasoning: 'Error in smart processing, created new memory as fallback',
        confidence: 0.5
      }
    }
  }

  /**
   * Find similar existing memories using semantic search
   */
  private async findSimilarMemories(
    content: string,
    memoryType: 'episodic' | 'long' | 'procedural',
    userId: string,
    similarityThreshold: number = 0.7
  ): Promise<Array<{id: string, content: string, timestamp: string, metadata?: any}>> {
    try {
      // Search for similar memories with high threshold
      const memory = await this.getMemoryInstance()
      const results = await memory.search(content, {
        userId,
        limit: 5 // Get top 5 most similar
      })

      // Filter by memory type and similarity
      const filteredResults = results
        .filter(result => {
          const resultType = result.metadata?.type || 'long'
          return resultType === memoryType
        })
        .map((result, index) => ({
          id: result.id || `existing_${index}`,
          content: result.data || result.memory || result.text || '',
          timestamp: result.metadata?.timestamp || new Date().toISOString(),
          metadata: result.metadata,
          score: result.metadata?.score || 0.8
        }))
        .filter(result => result.score >= similarityThreshold)

      console.log("[SmartMemory] Filtered similar memories:", filteredResults.length)
      return filteredResults

    } catch (error) {
      console.error("[SmartMemory] Error finding similar memories:", error)
      return []
    }
  }

  /**
   * Execute the memory decision
   */
  private async executeDecision(
    decision: MemoryDecision,
    originalContent: string,
    memoryType: 'episodic' | 'long' | 'procedural',
    options: SmartMemoryOptions
  ): Promise<MemoryOperationResult> {
    const { action, targetIds, mergedContent, reasoning, confidence } = decision
    const memory = await this.getMemoryInstance()

    switch (action) {
      case 'CREATE':
        await memory.add([{ role: 'system', content: mergedContent }], {
          ...options,
          metadata: {
            ...options.metadata,
            type: memoryType,
            action: 'created',
            reasoning
          }
        })
        
        return {
          action: 'CREATE',
          content: mergedContent,
          reasoning,
          confidence
        }

      case 'UPDATE':
        // For vector stores, we typically can't update individual documents
        // So we'll delete the old one and create a new one
        // This is a limitation of most vector stores
        if (targetIds && targetIds.length > 0) {
          // In a real implementation, you'd delete the old memory first
          // For now, we'll just create the updated version
          await memory.add([{ role: 'system', content: mergedContent }], {
            ...options,
            metadata: {
              ...options.metadata,
              type: memoryType,
              action: 'updated',
              replacedIds: targetIds,
              reasoning
            }
          })
        }

        return {
          action: 'UPDATE',
          content: mergedContent,
          reasoning,
          confidence,
          existingMemoriesUsed: targetIds?.length || 0
        }

      case 'MERGE':
        // Create merged memory
        await memory.add([{ role: 'system', content: mergedContent }], {
          ...options,
          metadata: {
            ...options.metadata,
            type: memoryType,
            action: 'merged',
            mergedIds: targetIds,
            reasoning
          }
        })

        return {
          action: 'MERGE',
          content: mergedContent,
          reasoning,
          confidence,
          existingMemoriesUsed: targetIds?.length || 0
        }

      case 'APPEND':
        // Create appended memory
        await memory.add([{ role: 'system', content: mergedContent }], {
          ...options,
          metadata: {
            ...options.metadata,
            type: memoryType,
            action: 'appended',
            appendedToIds: targetIds,
            reasoning
          }
        })

        return {
          action: 'APPEND',
          content: mergedContent,
          reasoning,
          confidence,
          existingMemoriesUsed: targetIds?.length || 0
        }

      case 'IGNORE':
        console.log("[SmartMemory] Ignoring redundant memory:", reasoning)
        
        return {
          action: 'IGNORE',
          content: originalContent,
          reasoning,
          confidence
        }

      default:
        // Fallback to CREATE
        await memory.add([{ role: 'system', content: originalContent }], options)
        
        return {
          action: 'CREATE',
          content: originalContent,
          reasoning: 'Unknown action, defaulted to create',
          confidence: 0.5
        }
    }
  }
}

// Singleton instance
let smartMemoryService: SmartMemoryService | null = null

export function getSmartMemoryService(): SmartMemoryService {
  if (!smartMemoryService) {
    smartMemoryService = new SmartMemoryService()
  }
  return smartMemoryService
}

export type { MemoryOperationResult }
