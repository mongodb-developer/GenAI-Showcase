import { analyzeContent } from "@/lib/ai-agent"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { content, title, selectedFeatures } = await req.json()

    if (!content || !title || !selectedFeatures) {
      return NextResponse.json({ error: "Content, title, and selected features are required" }, { status: 400 })
    }

    const analysis = await analyzeContent(content, title, selectedFeatures)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Error analyzing content:", error)

    let errorMessage = "Failed to analyze content"
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

