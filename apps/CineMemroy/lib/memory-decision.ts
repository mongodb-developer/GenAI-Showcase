import { generateObject } from "ai"
import { z } from "zod"
import { getMemoryDecisionModel } from "./model-factory"

// Schema for memory decision output
const MemoryDecisionSchema = z.object({
  action: z.enum(['UPDATE', 'MERGE', 'APPEND', 'CREATE', 'IGNORE']),
  targetIds: z.array(z.string()).optional(),
  mergedContent: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1)
})

export type MemoryDecision = z.infer<typeof MemoryDecisionSchema>

interface ExistingMemory {
  id: string
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

interface MemoryDecisionOptions {
  newMemory: string
  memoryType: 'episodic' | 'long' | 'procedural'
  existingMemories: ExistingMemory[]
  userId: string
}

export class MemoryDecisionService {
  private model: any

  constructor(model?: any) {
    // Use provided model or get cached model from factory
    if (model) {
      this.model = model
    } else {
      this.model = getMemoryDecisionModel()
    }
  }

  async decideMemoryAction(options: MemoryDecisionOptions): Promise<MemoryDecision> {
    const { newMemory, memoryType, existingMemories, userId } = options

    console.log("[MemoryDecision] Making decision for:", {
      memoryType,
      newMemoryLength: newMemory.length,
      existingCount: existingMemories.length,
      userId
    })

    // If no existing memories, always create new
    if (existingMemories.length === 0) {
      return {
        action: 'CREATE',
        mergedContent: newMemory,
        reasoning: 'No existing similar memories found',
        confidence: 1.0
      }
    }

    // Build context for the decision
    const existingMemoriesText = existingMemories
      .map((mem, index) => `${index + 1}. ID: ${mem.id} | Content: "${mem.content}" | Created: ${mem.timestamp}`)
      .join('\n')

    const prompt = `You are a memory management system for user "${userId}". Analyze if a new memory should update existing memories or be created as new.

NEW MEMORY: "${newMemory}"
MEMORY TYPE: "${memoryType}"

EXISTING SIMILAR MEMORIES:
${existingMemoriesText}

DECISION CRITERIA:
- UPDATE: New information enhances/corrects existing memory (high similarity + new details)
- MERGE: Multiple related memories should be consolidated into one
- APPEND: Add new information to existing memory without replacing
- CREATE: Information is genuinely new and different
- IGNORE: Information is redundant or low-value

For ${memoryType} memories:
${memoryType === 'long' ? '- Focus on factual updates, preference changes, and pattern consolidation' : ''}
${memoryType === 'episodic' ? '- Merge related episodes, update ongoing conversations' : ''}
${memoryType === 'procedural' ? '- Update steps with improvements, merge similar procedures' : ''}

Return your decision with reasoning.`

    try {
      const result = await generateObject({
        model: this.model,
        prompt,
        schema: MemoryDecisionSchema,
        temperature: 0.1 // Low temperature for consistent decisions
      })

      console.log("[MemoryDecision] Decision made:", result.object)
      return result.object

    } catch (error) {
      console.error("[MemoryDecision] Error making decision:", error)
      
      // Fallback to CREATE if decision fails
      return {
        action: 'CREATE',
        mergedContent: newMemory,
        reasoning: 'Decision service failed, defaulting to create new memory',
        confidence: 0.5
      }
    }
  }

  /**
   * Execute memory merge operation
   */
  async executeMerge(
    existingMemories: ExistingMemory[],
    newContent: string,
    memoryType: 'episodic' | 'long' | 'procedural'
  ): Promise<string> {
    const allContent = [
      ...existingMemories.map(m => m.content),
      newContent
    ].join('\n\n')

    const prompt = `Merge these ${memoryType} memories into a single, comprehensive memory:

MEMORIES TO MERGE:
${allContent}

Create a consolidated memory that:
- Preserves all important information
- Removes redundancy
- Maintains chronological order (for episodic)
- Consolidates patterns (for long-term facts)
- Streamlines steps (for procedures)

Return only the merged memory content.`

    try {
      const result = await generateObject({
        model: this.model,
        prompt,
        schema: z.object({
          mergedContent: z.string()
        }),
        temperature: 0.2
      })

      return result.object.mergedContent

    } catch (error) {
      console.error("[MemoryDecision] Error merging memories:", error)
      return allContent // Fallback to simple concatenation
    }
  }
}

// Singleton instance
let memoryDecisionService: MemoryDecisionService | null = null

export function getMemoryDecisionService(): MemoryDecisionService {
  if (!memoryDecisionService) {
    memoryDecisionService = new MemoryDecisionService()
  }
  return memoryDecisionService
}
