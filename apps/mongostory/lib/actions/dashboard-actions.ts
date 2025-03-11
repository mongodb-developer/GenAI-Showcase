"use server"

import clientPromise from "@/lib/mongodb"

export async function getDashboardData() {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    // Fetch recent content
    const recentContent = await db.collection("content").find({}).sort({ date: -1 }).limit(5).toArray()

    // Calculate analytics metrics
    const pageViews = await db.collection("pageViews").countDocuments({})

    // Calculate average time on page
    const sessionsData = await db
      .collection("sessions")
      .aggregate([{ $group: { _id: null, avgDuration: { $avg: "$duration" } } }])
      .toArray()
    const avgTimeOnPage = sessionsData.length > 0 ? Math.round(sessionsData[0].avgDuration) : 0

    // Calculate engagement rate
    const engagementData = await db
      .collection("sessions")
      .aggregate([
        {
          $group: {
            _id: null,
            engaged: {
              $sum: { $cond: [{ $gt: ["$duration", 30] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const engagementRate =
      engagementData.length > 0 ? Math.round((engagementData[0].engaged / engagementData[0].total) * 100) : 0

    // Calculate bounce rate
    const bounceData = await db
      .collection("sessions")
      .aggregate([
        {
          $group: {
            _id: null,
            bounces: {
              $sum: { $cond: [{ $lt: ["$duration", 10] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const bounceRate = bounceData.length > 0 ? Math.round((bounceData[0].bounces / bounceData[0].total) * 100) : 0

    // Get AI insights
    const contentWithAnalysis = await db
      .collection("content")
      .find({ analysis: { $exists: true } })
      .toArray()

    // Calculate average content quality score
    let totalQualityScore = 0
    let contentWithQualityScore = 0

    contentWithAnalysis.forEach((content) => {
      if (content.analysis?.analyses?.quality?.readabilityScore) {
        totalQualityScore += content.analysis.analyses.quality.readabilityScore
        contentWithQualityScore++
      }
    })

    const avgQualityScore =
      contentWithQualityScore > 0 ? Number.parseFloat((totalQualityScore / contentWithQualityScore).toFixed(1)) : 0

    // Extract top topics
    const topicsMap = new Map()

    contentWithAnalysis.forEach((content) => {
      if (content.analysis?.analyses?.topic?.mainTopics) {
        content.analysis.analyses.topic.mainTopics.forEach((topic) => {
          topicsMap.set(topic, (topicsMap.get(topic) || 0) + 1)
        })
      }
    })

    // Sort topics by frequency and get top 3
    const topTopics = Array.from(topicsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0])

    return {
      recentContent,
      analytics: {
        totalViews: pageViews,
        avgTimeOnPage,
        engagementRate,
        bounceRate,
      },
      aiInsights: {
        contentQuality: avgQualityScore,
        topTopics,
      },
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    throw new Error("Failed to fetch dashboard data")
  }
}

