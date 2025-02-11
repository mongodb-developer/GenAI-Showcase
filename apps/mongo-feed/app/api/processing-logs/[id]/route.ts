import { type NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise
    const db = client.db("mongofeed")

    const logs = await db
      .collection("processing_logs")
      .findOne({ chatId: new ObjectId(params.id) }, { projection: { _id: 0, logs: 1 } })

    if (!logs) {
      return NextResponse.json({ error: "Processing logs not found" }, { status: 404 })
    }

    return NextResponse.json(logs)
  } catch (error) {
    console.error("Error fetching processing logs:", error)
    return NextResponse.json({ error: "An error occurred while fetching processing logs." }, { status: 500 })
  }
}
