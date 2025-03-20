import { MongoClient, ObjectId } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env")
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export default clientPromise

export interface SocialMediaPost {
  _id?: ObjectId
  contentId: ObjectId
  platform: string
  content: string
  publishedAt: Date
  stats: {
    likes: number
    shares: number
    comments: number
    engagementScore: number
  }
}

export async function createSocialMediaPost(post: Omit<SocialMediaPost, "_id">): Promise<SocialMediaPost> {
  const client = await clientPromise
  const db = client.db("mongostory")
  const result = await db.collection<SocialMediaPost>("socialMediaPosts").insertOne(post)
  return { ...post, _id: result.insertedId }
}

export async function getSocialMediaPostsForContent(contentId: string): Promise<SocialMediaPost[]> {
  const client = await clientPromise
  const db = client.db("mongostory")
  return db
    .collection<SocialMediaPost>("socialMediaPosts")
    .find({ contentId: new ObjectId(contentId) })
    .sort({ publishedAt: -1 })
    .toArray()
}

export async function updateSocialMediaPostStats(postId: string, stats: SocialMediaPost["stats"]): Promise<void> {
  const client = await clientPromise
  const db = client.db("mongostory")
  await db.collection<SocialMediaPost>("socialMediaPosts").updateOne({ _id: new ObjectId(postId) }, { $set: { stats } })
}

export async function incrementPageView(contentId: string): Promise<void> {
  const client = await clientPromise
  const db = client.db("mongostory")
  await db.collection("pageViews").insertOne({ contentId, timestamp: new Date() })
  await db.collection("content").updateOne({ _id: new ObjectId(contentId) }, { $inc: { views: 1 } })
}

export async function recordUniqueVisitor(visitorId: string): Promise<void> {
  const client = await clientPromise
  const db = client.db("mongostory")
  await db
    .collection("uniqueVisitors")
    .updateOne({ visitorId }, { $setOnInsert: { firstVisit: new Date() } }, { upsert: true })
}

export async function recordSession(visitorId: string, duration: number): Promise<void> {
  const client = await clientPromise
  const db = client.db("mongostory")
  await db.collection("sessions").insertOne({ visitorId, duration, timestamp: new Date() })
}
