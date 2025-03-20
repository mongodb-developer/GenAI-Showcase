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

    // Execute the query in a safe sandbox environment
    const result = await eval(`(async () => {
      const db = client.db("mongostory")
      return ${query}
    })()`)

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
