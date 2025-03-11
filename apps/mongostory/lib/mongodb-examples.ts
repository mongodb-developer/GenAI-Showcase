export const mongodbExamples = {
  basics: [
    {
      title: "Creating Documents",
      description: "Insert a new document into a MongoDB collection",
      code: `// Insert a single document
await db.collection('content').insertOne({
  title: "My First Post",
  content: "Hello MongoDB!",
  createdAt: new Date(),
  tags: ["mongodb", "tutorial"]
})

// Insert multiple documents
await db.collection('content').insertMany([
  { title: "Post 1", content: "Content 1" },
  { title: "Post 2", content: "Content 2" }
])`,
      explanation:
        "MongoDB stores data in documents, which are similar to JSON objects. You can insert one or multiple documents at a time.",
    },
    {
      title: "Querying Documents",
      description: "Find documents using different query operators",
      code: `// Find all documents
const allDocs = await db.collection('content').find({}).toArray()

// Find with specific criteria
const posts = await db.collection('content').find({
  tags: "mongodb",
  createdAt: { $gte: new Date('2024-01-01') }
}).toArray()

// Find one document
const post = await db.collection('content').findOne({
  _id: new ObjectId("someId")
})`,
      explanation:
        "MongoDB provides a rich query language for finding documents. You can use operators like $gte (greater than or equal) and more.",
    },
  ],
  advanced: [
    {
      title: "Aggregation Pipeline",
      description: "Perform complex data transformations",
      code: `await db.collection('content').aggregate([
  // Match stage - filter documents
  { $match: { status: "published" } },
  
  // Lookup stage - join with another collection
  { $lookup: {
      from: "comments",
      localField: "_id",
      foreignField: "postId",
      as: "comments"
  }},
  
  // Add fields stage - compute new fields
  { $addFields: {
      commentCount: { $size: "$comments" },
      averageRating: { $avg: "$ratings" }
  }},
  
  // Group stage - aggregate data
  { $group: {
      _id: "$author",
      totalPosts: { $sum: 1 },
      avgComments: { $avg: "$commentCount" }
  }}
])`,
      explanation:
        "The aggregation pipeline is a powerful feature for data analysis and transformation. It processes documents through multiple stages.",
    },
  ],
  indexes: [
    {
      title: "Creating Indexes",
      description: "Optimize query performance with indexes",
      code: `// Create a single field index
await db.collection('content').createIndex({ title: 1 })

// Create a compound index
await db.collection('content').createIndex({ 
  author: 1, 
  createdAt: -1 
})

// Create a text index for full-text search
await db.collection('content').createIndex({ 
  title: "text", 
  content: "text" 
})`,
      explanation:
        "Indexes improve query performance and enable features like text search. The 1 or -1 specifies ascending or descending order.",
    },
  ],
  transactions: [
    {
      title: "Using Transactions",
      description: "Ensure data consistency with transactions",
      code: `const session = client.startSession()

try {
  await session.withTransaction(async () => {
    // Update post
    await db.collection('posts').updateOne(
      { _id: postId },
      { $set: { status: "published" } },
      { session }
    )
    
    // Create notification
    await db.collection('notifications').insertOne({
      type: "post_published",
      postId: postId,
      createdAt: new Date()
    }, { session })
  })
} finally {
  await session.endSession()
}`,
      explanation: "Transactions ensure multiple operations succeed or fail as a unit, maintaining data consistency.",
    },
  ],
}

