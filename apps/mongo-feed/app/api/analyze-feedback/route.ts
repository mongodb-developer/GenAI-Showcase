import { type NextRequest, NextResponse } from "next/server"
import { analyzeAgentFeedback, analyzeProductReview } from "@/lib/analyze-content"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const contentType = file.type
    const fileName = file.name

    let content: string | ArrayBuffer
    if (contentType.startsWith("image/")) {
      content = await file.arrayBuffer()
    } else {
      const buffer = await file.arrayBuffer()
      content = new TextDecoder().decode(buffer)
    }

    let analysisResult

    if (type === "agent") {
      analysisResult = await analyzeAgentFeedback(content as string)
    } else if (type === "product") {
      analysisResult = await analyzeProductReview(content, contentType, fileName)
    } else {
      return NextResponse.json({ error: "Invalid analysis type" }, { status: 400 })
    }

    // Store the analysis result in MongoDB
    const client = await clientPromise
    const db = client.db("mongofeed")
    await db.collection("chat_analyses").insertOne({
      type,
      contentType,
      fileName,
      analysis: analysisResult,
      createdAt: new Date(),
    })

    return NextResponse.json({ sentiments: analysisResult })
  } catch (error) {
    console.error("Error analyzing feedback:", error)
    return NextResponse.json({ error: "An error occurred while analyzing feedback." }, { status: 500 })
  }
}
