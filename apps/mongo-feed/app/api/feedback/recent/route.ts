import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} days ago`
}

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const recentFeedback = await db.collection("chat_analyses").find({}).sort({ createdAt: -1 }).limit(5).toArray()

    const formattedFeedback = recentFeedback.map((feedback) => {
      const analysis = feedback.analysis || []
      const mainTopic = Array.isArray(analysis) && analysis.length > 0 ? analysis[0].name : "General Feedback"

      // Calculate sentiment score based on analysis array
      const sentimentScore = Array.isArray(analysis)
        ? analysis.reduce((score, item) => {
            if (item.sentiment === "positive") return score + 5
            if (item.sentiment === "negative") return score + 1
            return score + 3
          }, 0) / analysis.length
        : 3.0

      return {
        id: feedback._id.toString(),
        score: Number.parseFloat(sentimentScore.toFixed(1)),
        title: mainTopic,
        type: feedback.type || "agent",
        timeAgo: getTimeAgo(new Date(feedback.createdAt)),
      }
    })

    return NextResponse.json(formattedFeedback)
  } catch (error) {
    console.error("Error fetching recent feedback:", error)
    return NextResponse.json({ error: "Failed to fetch recent feedback" }, { status: 500 })
  }
}

