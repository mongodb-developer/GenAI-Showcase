import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const pastAnalysis = await db
      .collection("chat_queue")
      .find({
        status: "completed",
        updatedAt: { $lt: fiveMinutesAgo },
      })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray()

    const formattedAnalysis = pastAnalysis.map((item) => ({
      id: item._id.toString(),
      name: `Analysis ${item._id.toString().slice(-6)}`,
      date: item.updatedAt.toISOString(),
      duration: calculateDuration(item.createdAt, item.updatedAt),
      status: item.status,
    }))

    return NextResponse.json(formattedAnalysis)
  } catch (error) {
    console.error("Error fetching past analysis:", error)
    return NextResponse.json({ error: "An error occurred while fetching past analysis." }, { status: 500 })
  }
}

function calculateDuration(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime()
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}
