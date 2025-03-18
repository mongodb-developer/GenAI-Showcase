import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(req: Request) {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    // Get all clusters from the clusters collection
    const clustersData = await db.collection("clusters").find({}).toArray()

    // Get all content documents that are referenced in any cluster
    const allContentIds = clustersData.flatMap((cluster) => cluster.contentIds.map((id) => new ObjectId(id)))

    const contentItems = await db
      .collection("content")
      .find({ _id: { $in: allContentIds } })
      .toArray()

    // Create a map of content items by ID for quick lookup
    const contentMap = new Map(contentItems.map((item) => [item._id.toString(), item]))

    // Format clusters with their content items
    const clusters = clustersData.map((cluster) => ({
      id: cluster.id,
      label: cluster.label,
      keywords: cluster.keywords || [],
      contentIds: cluster.contentIds,
      // Add the actual content items to each cluster
      items: cluster.contentIds.map((id) => contentMap.get(id)).filter(Boolean), // Remove any undefined items
    }))

    return NextResponse.json({
      clusters,
      totalClusters: clusters.length,
      totalContent: contentItems.length,
    })
  } catch (error) {
    console.error("Error getting clusters:", error)
    return NextResponse.json({ error: "Failed to get clusters" }, { status: 500 })
  }
}
