import { NextResponse } from "next/server"
import { xai } from "@ai-sdk/xai"
import { generateText } from "ai"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!params.id) {
      return NextResponse.json({ error: "Content ID is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    // Get the original content
    const originalContent = await db.collection("content").findOne({
      _id: new ObjectId(params.id),
    })

    if (!originalContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    if (!originalContent.analysis) {
      return NextResponse.json(
        { error: "Original content must be analyzed before applying recommendations" },
        { status: 400 },
      )
    }

    const model = xai("grok-2-1212")

    // Generate revised content based on analysis
    const { text: revisedContent } = await generateText({
      model,
      prompt: `Revise the following content incorporating all the analysis recommendations:

Original Title: ${originalContent.title}
Original Content: ${originalContent.content}

Analysis Summary: ${originalContent.analysis?.summary}

SEO Recommendations: ${originalContent.analysis?.analyses.seo?.improvements.join("\n")}
Quality Recommendations: ${originalContent.analysis?.analyses.quality?.suggestions.join("\n")}
Emotional Impact Suggestions: ${originalContent.analysis?.analyses.emotional?.suggestions?.join("\n")}
Topic Suggestions: ${originalContent.analysis?.analyses.topic?.suggestions?.join("\n")}

Please provide the revised content in markdown format, maintaining the same structure but implementing all the improvements.`,
    })

    // Generate revised title
    const { text: revisedTitle } = await generateText({
      model,
      prompt: `Based on the SEO recommendations, create an optimized title for this content that maintains the core message but implements the suggested improvements:

Original Title: ${originalContent.title}
SEO Title Suggestion: ${originalContent.analysis?.analyses.seo?.title}

Provide only the new title, nothing else.`,
    })

    // Create the revised version
    const revisedVersion = {
      title: revisedTitle.trim(),
      content: revisedContent.trim(),
      parentId: originalContent._id,
      author: "AI Assistant",
      date: new Date().toISOString(),
      status: "draft",
      aiFeatures: originalContent.aiFeatures,
      isRevision: true,
      revisionNote: "Applied AI recommendations",
    }

    // Analyze the revised content immediately
    const analysisResponse = await fetch(new URL("/api/analyze", req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: revisedContent.trim(),
        title: revisedTitle.trim(),
        selectedFeatures: originalContent.aiFeatures,
      }),
    })

    if (!analysisResponse.ok) {
      throw new Error("Failed to analyze revised content")
    }

    const analysis = await analysisResponse.json()
    revisedVersion.analysis = analysis

    const result = await db.collection("content").insertOne(revisedVersion)

    if (!result.acknowledged) {
      throw new Error("Failed to save revised content")
    }

    return NextResponse.json({
      _id: result.insertedId,
      ...revisedVersion,
    })
  } catch (error) {
    console.error("Error revising content:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise content" },
      { status: 500 },
    )
  }
}

