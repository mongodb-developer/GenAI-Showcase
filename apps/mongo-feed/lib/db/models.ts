import type { Collection, Db } from "mongodb"
import clientPromise from "../mongodb"
import type { ProcessedChat } from "@/types/chat"

let cachedDb: Db | null = null
let cachedChats: Collection<ProcessedChat> | null = null

export async function getDatabase() {
  if (cachedDb) return cachedDb

  const client = await clientPromise
  const db = client.db("mongofeed")
  cachedDb = db
  return db
}

export async function getChatsCollection() {
  if (cachedChats) return cachedChats

  const db = await getDatabase()
  const chats = db.collection<ProcessedChat>("chats")

  // Create indexes if they don't exist
  await chats.createIndex({ createdAt: -1 })
  await chats.createIndex({ overallSentiment: 1 })
  await chats.createIndex({ mainTopics: 1 })

  cachedChats = chats
  return chats
}

