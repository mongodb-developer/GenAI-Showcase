import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import type { Settings } from "@/types/settings"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    const settings = await db.collection("settings").findOne({})

    if (!settings) {
      // Return default settings if none exist
      const defaultSettings: Settings = {
        siteTitle: "My MongoStroy Site",
        description: "A powerful CMS built with MongoStroy",
        language: "en",
        timezone: "UTC",
        aiFeatures: {
          contentAnalysis: { enabled: true },
          seoOptimization: { enabled: true },
          qualityCheck: { enabled: true },
          emotionalImpact: { enabled: true },
          topicAnalysis: { enabled: true },
          autoTranslation: { enabled: true },
          contentSummarization: { enabled: true },
          tagRecommendation: { enabled: true },
          sentimentAnalysis: { enabled: true },
          abHeadlineTesting: { enabled: true },
        },
        integrations: {},
        userRoles: [
          { id: 1, name: "Admin", permissions: ["create", "edit", "publish", "delete"] },
          { id: 2, name: "Editor", permissions: ["create", "edit", "publish"] },
          { id: 3, name: "Author", permissions: ["create", "edit"] },
        ],
      }

      await db.collection("settings").insertOne(defaultSettings)
      return NextResponse.json(defaultSettings)
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const settings: Settings = await req.json()
    const client = await clientPromise
    const db = client.db("mongostory")

    // Remove _id from settings object if it exists
    const { _id, ...settingsWithoutId } = settings as Settings & { _id?: string }

    const result = await db.collection("settings").updateOne(
      {}, // Empty filter to match first document
      { $set: settingsWithoutId },
      { upsert: true },
    )

    if (!result.acknowledged) {
      throw new Error("Failed to update settings")
    }

    return NextResponse.json(settingsWithoutId)
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}

