import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function POST(req: Request) {
  try {
    const { query } = await req.json()

    // IMPORTANT: In a production environment, you should:
    // 1. Validate and sanitize the query
    // 2. Implement proper security measures
    // 3. Limit the operations that can be performed
    // This is just for learning purposes

    const client = await clientPromise
    const db = client.db("mongostory")

    // Validate and execute the query securely
    if (typeof query !== "object" || query === null) {
      throw new Error("Invalid query format. Query must be a non-null object.");
    }

    // Example: Allow only find operations with specific constraints
    if (!query.collection || !query.filter || typeof query.collection !== "string" || typeof query.filter !== "object") {
      throw new Error("Invalid query structure. Must include 'collection' (string) and 'filter' (object).");
    }

    const collection = db.collection(query.collection);
    const result = await collection.find(query.filter).toArray();

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("MongoDB Playground Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 },
    )
  }
}
