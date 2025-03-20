import { NextResponse } from "next/server"
import { createSocialMediaPost, getSocialMediaPostsForContent, type SocialMediaPost } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contentId, platform, content } = body

    if (!contentId || !platform || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const newPost: Omit<SocialMediaPost, "_id"> = {
      contentId: new ObjectId(contentId),
      platform,
      content,
      publishedAt: new Date(),
      stats: {
        likes: 0,
        shares: 0,
        comments: 0,
        engagementScore: 0,
      },
    }

    const createdPost = await createSocialMediaPost(newPost)
    return NextResponse.json(createdPost)
  } catch (error) {
    console.error("Error creating social media post:", error)
    return NextResponse.json({ error: "Failed to create social media post" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const contentId = searchParams.get("contentId")

    if (!contentId) {
      return NextResponse.json({ error: "Content ID is required" }, { status: 400 })
    }

    const posts = await getSocialMediaPostsForContent(contentId)
    return NextResponse.json(posts)
  } catch (error) {
    console.error("Error fetching social media posts:", error)
    return NextResponse.json({ error: "Failed to fetch social media posts" }, { status: 500 })
  }
}
