import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { embed } from "ai"
import { openai } from "@ai-sdk/openai"

// Helper function to check if a string is a valid MongoDB ObjectId
function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id
}

export async function GET(request: Request) {
  try {
    // Extract query parameters from the request URL
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query")
    const productId = searchParams.get("productId")
    const category = searchParams.get("category")
    const random = searchParams.get("random") === "true"

    // Connect to MongoDB
    const client = await clientPromise
    const collection = client.db("ai_shop").collection("products")

    let result
    let searchType

    // Case 1: Search by product ID
    if (productId) {
      searchType = "Exact ID"
      console.log(`Performing ${searchType} search for product ID: ${productId}`)

      const filter: any = {}
      if (isValidObjectId(productId)) {
        filter._id = new ObjectId(productId)
      } else {
        filter._id = productId
      }

      result = await collection.findOne(filter)
      if (!result) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 })
      }
      result = { ...result, _id: result._id.toString() }
    }
    // Case 2: Get random products
    else if (random) {
      searchType = "Random"
      console.log(`Performing ${searchType} search for 9 random products`)

      result = await collection
        .aggregate([
          { $sample: { size: 9 } },
          {
            $project: {
              _id: { $toString: "$_id" },
              title: 1,
              price: 1,
              description: 1,
              category: 1,
              emoji: 1,
              process: 1,
            },
          },
        ])
        .toArray()
    }
    // Case 3: Hybrid search (vector + full-text)
    else if (query || category) {
      searchType = "Hybrid"
      console.log(`Performing ${searchType} search for query: ${query}, category: ${category}`)

      const vectorWeight = 0.1
      const fullTextWeight = 0.9

      // Generate embedding for the query
      let embedding
      if (query) {
        const { embedding: queryEmbedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: query,
        })
        embedding = queryEmbedding
      }

      // Construct the aggregation pipeline for hybrid search
      const pipeline: any[] = [
        // Step 1: Perform vector search
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embeddings",
            queryVector: embedding,
            numCandidates: 100,
            limit: 20,
          },
        },
        // Step 2: Group results
        {
          $group: {
            _id: null,
            docs: { $push: "$$ROOT" },
          },
        },
        // Step 3: Unwind grouped results
        {
          $unwind: {
            path: "$docs",
            includeArrayIndex: "rank",
          },
        },
        // Step 4: Calculate vector search score
        {
          $addFields: {
            vs_score: {
              $multiply: [
                vectorWeight,
                {
                  $divide: [1.0, { $add: ["$rank", 60] }],
                },
              ],
            },
          },
        },
        // Step 5: Project relevant fields
        {
          $project: {
            vs_score: 1,
            _id: "$docs._id",
            title: "$docs.title",
            price: "$docs.price",
            description: "$docs.description",
            category: "$docs.category",
            emoji: "$docs.emoji",
            process: "$docs.process",
          },
        },
        // Step 6: Combine with full-text search results
        {
          $unionWith: {
            coll: "products",
            pipeline: [
              // Perform full-text search
              {
                $search: {
                  index: "default",
                  text: {
                    query: query,
                    path: ["title", "description", "category"],
                  },
                },
              },
              { $limit: 20 },
              // Group and unwind results (similar to vector search)
              {
                $group: {
                  _id: null,
                  docs: { $push: "$$ROOT" },
                },
              },
              {
                $unwind: {
                  path: "$docs",
                  includeArrayIndex: "rank",
                },
              },
              // Calculate full-text search score
              {
                $addFields: {
                  fts_score: {
                    $multiply: [
                      fullTextWeight,
                      {
                        $divide: [1.0, { $add: ["$rank", 60] }],
                      },
                    ],
                  },
                },
              },
              // Project relevant fields
              {
                $project: {
                  fts_score: 1,
                  _id: "$docs._id",
                  title: "$docs.title",
                  price: "$docs.price",
                  description: "$docs.description",
                  category: "$docs.category",
                  emoji: "$docs.emoji",
                  process: "$docs.process",
                },
              },
            ],
          },
        },
        // Step 7: Group results by _id to remove duplicates
        {
          $group: {
            _id: "$_id",
            title: { $first: "$title" },
            price: { $first: "$price" },
            description: { $first: "$description" },
            category: { $first: "$category" },
            emoji: { $first: "$emoji" },
            process: { $first: "$process" },
            vs_score: { $max: "$vs_score" },
            fts_score: { $max: "$fts_score" },
          },
        },
        // Step 8: Ensure all documents have both scores
        {
          $project: {
            _id: 1,
            title: 1,
            price: 1,
            description: 1,
            category: 1,
            emoji: 1,
            process: 1,
            vs_score: { $ifNull: ["$vs_score", 0] },
            fts_score: { $ifNull: ["$fts_score", 0] },
          },
        },
        // Step 9: Calculate final score
        {
          $addFields: {
            score: { $add: ["$fts_score", "$vs_score"] },
          },
        },
        // Step 10: Sort by final score and limit results
        { $sort: { score: -1 } },
        { $limit: 10 },
      ]

      // Execute the aggregation pipeline
      result = await collection.aggregate(pipeline).toArray()
    }
    // Case 4: Get all products (fallback)
    else {
      searchType = "All Products"
      console.log(`Performing ${searchType} search (no query or ID provided)`)

      result = await collection.find({}).toArray()
      result = result.map((product) => ({
        ...product,
        _id: product._id.toString(),
      }))
    }

    console.log(`${searchType} search completed. Found ${Array.isArray(result) ? result.length : 1} product(s).`)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Products API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

