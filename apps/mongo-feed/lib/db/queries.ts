import { getChatsCollection } from "./models"
import { ProcessedChat } from "@/types/chat"

export async function getRecentChats(limit = 5) {
  const collection = await getChatsCollection()
  return collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function getSentimentStats() {
  const collection = await getChatsCollection()
  const stats = await collection
    .aggregate([
      {
        $group: {
          _id: {
            type: "$type",
            sentiment: "$analysis.sentiment",
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const result = {
    agent: { positive: 0, negative: 0, neutral: 0 },
    product: { positive: 0, negative: 0, neutral: 0 },
  }

  stats.forEach(({ _id, count }) => {
    result[_id.type][_id.sentiment] = count
  })

  return result
}

export async function getTopIssues(limit = 5) {
  const collection = await getChatsCollection()
  return collection
    .aggregate([
      {
        $group: {
          _id: {
            type: "$type",
            name: "$analysis.name",
          },
          count: { $sum: 1 },
          sentiment: { $first: "$analysis.sentiment" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ])
    .toArray()
}

export async function getDailyFeedbackTrend(days = 30) {
  const collection = await getChatsCollection()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  return collection
    .aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          positive: {
            $sum: { $cond: [{ $eq: ["$analysis.sentiment", "positive"] }, 1, 0] },
          },
          negative: {
            $sum: { $cond: [{ $eq: ["$analysis.sentiment", "negative"] }, 1, 0] },
          },
          neutral: {
            $sum: { $cond: [{ $eq: ["$analysis.sentiment", "neutral"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.date": 1 } },
    ])
    .toArray()
}
