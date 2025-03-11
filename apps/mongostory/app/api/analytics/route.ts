import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

interface TimeRange {
  $gte: Date
  $lt: Date
}

function getTimeRange(period = "7d"): TimeRange {
  const now = new Date()
  const ranges: Record<string, TimeRange> = {
    "24h": {
      $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      $lt: now,
    },
    "7d": {
      $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      $lt: now,
    },
    "30d": {
      $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      $lt: now,
    },
  }

  return ranges[period] || ranges["7d"]
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get("period") || "7d"
    const timeRange = getTimeRange(period)

    const client = await clientPromise
    const db = client.db("mongostory")

    // Get total page views and unique visitors for the period
    const pageViews = await db.collection("pageViews").countDocuments({
      timestamp: timeRange,
    })

    const uniqueVisitors = await db.collection("uniqueVisitors").countDocuments({
      lastVisit: timeRange,
    })

    // Get page views over time
    const pageViewTrends = await db
      .collection("pageViews")
      .aggregate([
        {
          $match: {
            timestamp: timeRange,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$timestamp",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])
      .toArray()

    // Get top performing content with engagement metrics
    const topContent = await db
      .collection("content")
      .aggregate([
        {
          $match: {
            status: "published",
          },
        },
        {
          $lookup: {
            from: "pageViews",
            let: { contentId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$contentId", "$$contentId"] },
                      { $gte: ["$timestamp", timeRange.$gte] },
                      { $lt: ["$timestamp", timeRange.$lt] },
                    ],
                  },
                },
              },
            ],
            as: "recentViews",
          },
        },
        {
          $lookup: {
            from: "sessions",
            let: { contentId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$contentId", "$$contentId"] },
                      { $gte: ["$timestamp", timeRange.$gte] },
                      { $lt: ["$timestamp", timeRange.$lt] },
                    ],
                  },
                },
              },
            ],
            as: "sessions",
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            views: { $size: "$recentViews" },
            uniqueVisitors: {
              $size: {
                $setUnion: "$recentViews.visitorId",
              },
            },
            averageTimeSpent: {
              $cond: [{ $gt: [{ $size: "$sessions" }, 0] }, { $avg: "$sessions.duration" }, 0],
            },
            totalTimeSpent: { $sum: "$sessions.duration" },
          },
        },
        {
          $sort: { views: -1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray()

    // Get visitor engagement distribution
    const sessionDistribution = await db
      .collection("sessions")
      .aggregate([
        {
          $match: {
            timestamp: timeRange,
          },
        },
        {
          $bucket: {
            groupBy: "$duration",
            boundaries: [0, 30, 60, 300, 600, 1800, 3600],
            default: "3600+",
            output: {
              count: { $sum: 1 },
            },
          },
        },
      ])
      .toArray()

    // Calculate average session duration
    const sessionStats = await db
      .collection("sessions")
      .aggregate([
        {
          $match: {
            timestamp: timeRange,
          },
        },
        {
          $group: {
            _id: null,
            averageDuration: { $avg: "$duration" },
            totalSessions: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const averageSessionDuration = sessionStats[0]?.averageDuration || 0

    return NextResponse.json({
      pageViews,
      uniqueVisitors,
      pageViewTrends,
      topContent,
      sessionDistribution,
      averageSessionDuration,
      period,
    })
  } catch (error) {
    console.error("Error fetching analytics data:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch analytics data",
      },
      { status: 500 },
    )
  }
}

