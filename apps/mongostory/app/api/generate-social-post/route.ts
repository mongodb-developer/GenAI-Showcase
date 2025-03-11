import { generateSocialMediaPost } from "@/lib/social-media-ai-agent"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { title, content, platform, contentId, isPublished } = await req.json()

    if (!title || !content || !platform) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate the article URL if the content is published
    const articleUrl = isPublished ? `${process.env.NEXT_PUBLIC_APP_URL}/content/${contentId}` : undefined

    const socialPost = await generateSocialMediaPost(title, content, platform, articleUrl)

    return NextResponse.json(socialPost)
  } catch (error) {
    console.error("Error generating social media post:", error)
    return NextResponse.json({ error: "Failed to generate social media post" }, { status: 500 })
  }
}

