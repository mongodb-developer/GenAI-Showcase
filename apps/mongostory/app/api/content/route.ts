import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")
    const content = await db.collection("content").find({}).sort({ date: -1 }).toArray()

    return NextResponse.json(content)
  } catch (error) {
    console.error("Error fetching content:", error)
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const client = await clientPromise
    const db = client.db("mongostory")

    const newContent = {
      ...body,
      status: body.status || "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysis: body.analysis || null,
    }

    const result = await db.collection("content").insertOne(newContent)

    return NextResponse.json({
      _id: result.insertedId,
      ...newContent,
    })
  } catch (error) {
    console.error("Error creating content:", error)
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 })
  }
}

