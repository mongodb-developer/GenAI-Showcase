import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const queue = await db
      .collection("chat_queue")
      .find({
        $or: [
          { status: { $in: ["pending", "processing"] } },
          {
            status: "completed",
            updatedAt: { $gte: fiveMinutesAgo },
          },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()

    const queueItems = await Promise.all(
      queue.map(async (item) => {
        const logs = await db.collection("processing_logs").findOne({ chatId: item._id })
        const progress =
          item.status === "completed"
            ? 100
            : item.status === "processing"
              ? 50
              : item.status === "pending"
                ? 25
                : item.status === "error"
                  ? 0
                  : 25

        return {
          id: item._id.toString(),
          name: `Analysis ${item._id.toString().slice(-6)}`,
          progress,
          status: item.status,
          type: item.type || "agent", // Default to "agent" for backward compatibility
        }
      }),
    )

    return NextResponse.json(queueItems)
  } catch (error) {
    console.error("Error fetching process queue:", error)
    return NextResponse.json({ error: "An error occurred while fetching the process queue." }, { status: 500 })
  }
}
