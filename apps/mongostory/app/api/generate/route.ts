import { xai } from "@ai-sdk/xai"
import { generateText } from "ai"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { content } = await req.json()

    // Generate content summary
    const { text: summary } = await generateText({
      model: xai("grok-2-1212"),
      prompt: `Summarize the following content in 2-3 sentences: ${content}`,
    })

    // Generate SEO optimized title
    const { text: seoTitle } = await generateText({
      model: xai("grok-2-1212"),
      prompt: `Generate an SEO-optimized title for this content: ${content}`,
    })

    // Generate SEO description
    const { text: seoDescription } = await generateText({
      model: xai("grok-2-1212"),
      prompt: `Write a compelling meta description (under 160 characters) for this content: ${content}`,
    })

    // Analyze sentiment
    const { text: sentiment } = await generateText({
      model: xai("grok-2-1212"),
      prompt: `Analyze the sentiment and emotional tone of this content. Include percentage breakdowns of detected emotions: ${content}`,
    })

    // Generate tag recommendations
    const { text: tagSuggestions } = await generateText({
      model: xai("grok-2-1212"),
      prompt: `Suggest 5-7 relevant tags for this content, separated by commas: ${content}`,
    })

    return NextResponse.json({
      aiGeneratedContent: {
        summary,
        seoOptimizedTitle: seoTitle,
        seoDescription,
        sentimentAnalysis: sentiment,
        tags: tagSuggestions.split(",").map((tag) => tag.trim()),
      },
    })
  } catch (error) {
    console.error("Error generating AI content:", error)
    return NextResponse.json({ error: "Failed to generate AI content" }, { status: 500 })
  }
}

