import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { generateEmbedding } from "@/lib/embeddings"
import { performVectorSearch } from "@/lib/vector-search"
import { xai } from "@ai-sdk/xai"
import { generateText } from "ai"

export async function POST() {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    // First, ensure all content has embeddings
    const contents = await db
      .collection("content")
      .find({
        $or: [{ embedding: { $exists: false } }, { embeddingUpdatedAt: { $exists: false } }],
      })
      .toArray()

    // Generate embeddings for content that needs it
    let updatedCount = 0
    for (const content of contents) {
      if (content.analysis?.summary || content.content) {
        try {
          const textToEmbed = content.analysis?.summary || content.content
          const embedding = await generateEmbedding(textToEmbed)

          await db.collection("content").updateOne(
            { _id: content._id },
            {
              $set: {
                embedding,
                embeddingUpdatedAt: new Date().toISOString(),
              },
            },
          )
          updatedCount++
        } catch (error) {
          console.error(`Error generating embedding for content ${content._id}:`, error)
        }
      }
    }

    // Now generate clusters
    const allContent = await db
      .collection("content")
      .find({ embedding: { $exists: true } })
      .toArray()

    const clusters = []
    const processedIds = new Set()

    for (const content of allContent) {
      if (processedIds.has(content._id.toString())) continue

      // Find similar content using vector search
      const similar = await performVectorSearch(content.embedding, {
        limit: 5,
        minScore: 0.8,
        excludeIds: [content._id.toString()],
      })

      // Extract keywords from the content
      const keywords = extractKeywords([content, ...similar].map((item) => item.content).join(" "))

      // Get content samples for better label generation
      const contentSamples = [content, ...similar].map((item) => item.content)

      const cluster = {
        id: clusters.length + 1,
        label: await generateClusterLabel(keywords, contentSamples),
        keywords,
        contentIds: [content._id.toString(), ...similar.map((item) => item._id.toString())],
      }

      // Save cluster
      await db.collection("clusters").insertOne({
        ...cluster,
        _id: new ObjectId(),
        createdAt: new Date().toISOString(),
      })

      clusters.push(cluster)

      // Mark all items in this cluster as processed
      processedIds.add(content._id.toString())
      similar.forEach((item) => processedIds.add(item._id.toString()))
    }

    return NextResponse.json({
      message: "Clusters regenerated successfully",
      updatedCount,
      clustersGenerated: clusters.length,
    })
  } catch (error) {
    console.error("Error regenerating clusters:", error)
    return NextResponse.json({ error: "Failed to regenerate clusters" }, { status: 500 })
  }
}

// Helper function to extract keywords from text
function extractKeywords(text: string): string[] {
  if (!text) return []

  const words = text.toLowerCase().split(/\W+/)
  const stopWords = new Set(["the", "and", "a", "an", "in", "on", "at", "to", "for", "of", "with"])

  const wordCounts = words
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

// Helper function to generate a cluster label from keywords and content
async function generateClusterLabel(keywords: string[], contentSamples: string[]): Promise<string> {
  if (keywords.length === 0) return "Untitled Cluster"

  try {
    // Take a sample of content to provide context
    const contentSample = contentSamples.slice(0, 3).join("\n\n").substring(0, 1000)

    const model = xai("grok-2-1212")
    const { text } = await generateText({
      model,
      prompt: `Generate a concise, descriptive label (3-5 words) for a content cluster with these keywords: ${keywords.join(", ")}.

Sample content from this cluster:
${contentSample}

The label should be specific, meaningful, and accurately represent the main theme of the content.
Return ONLY the label, nothing else.`,
    })

    return text.trim()
  } catch (error) {
    console.error("Error generating cluster label:", error)
    // Fallback to simple method if AI generation fails
    const label = keywords.slice(0, 3).join(", ")
    return `${label.charAt(0).toUpperCase() + label.slice(1)} Cluster`
  }
}
