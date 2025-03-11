import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"

/**
 * Performs a vector search in MongoDB Atlas using the vector_index
 * @param queryVector The embedding vector to search with
 * @param options Additional options for the search
 * @returns Array of documents with similarity scores
 */
export async function performVectorSearch(
  queryVector: number[],
  options: {
    limit?: number
    excludeIds?: string[]
    filter?: Record<string, any>
    collection?: string
  } = {},
) {
  const { limit = 10, excludeIds = [], filter = {}, collection = "content" } = options

  const client = await clientPromise
  const db = client.db("mongostory")

  // Prepare match stage if we have exclusions or filters
  const matchStage: Record<string, any> = { ...filter }

  // Add exclusion of IDs if provided
  if (excludeIds.length > 0) {
    matchStage._id = { $nin: excludeIds.map((id) => new ObjectId(id)) }
  }

  // Build the aggregation pipeline
  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: "vector_index",
        queryVector,
        path: "embedding",
        numCandidates: limit * 10, // Retrieve more candidates for better results
        limit: limit + excludeIds.length, // Add extra to account for excluded docs
      },
    },
  ]

  // Add match stage if we have any filters
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage })
  }

  // Add limit and projection
  pipeline.push(
    { $limit: limit },
    {
      $project: {
        _id: 1,
        title: 1,
        content: 1,
        date: 1,
        status: 1,
        author: 1,
        translations: 1,
        analysis: 1,
        similarityScore: { $meta: "vectorSearchScore" },
      },
    },
  )

  // Execute the search
  const results = await db.collection(collection).aggregate(pipeline).toArray()

  return results
}

