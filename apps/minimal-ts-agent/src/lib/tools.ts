import { tool } from "ai";
import { z } from "zod";
import clientPromise from "./mongodb";

// ============================================================
// Voyage AI query embedding helper (using voyage-3-lite for speed)
// ============================================================
async function getQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_AI_API_KEY}`,
    },
    body: JSON.stringify({
      input: [query],
      model: "voyage-4-lite",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ============================================================
// The Search Tool — the agent's "instruction manual" for MongoDB
// ============================================================
export const searchDocumentation = tool({
  description:
    "Search the MongoDB Brand Book documentation to find information about tone of voice, writing guidelines, grammar rules, and brand style. Use this tool whenever the user asks about how MongoDB communicates, writes, or presents itself.",
  inputSchema: z.object({
    query: z.string().describe("The search query to find relevant brand book sections"),
  }),
  execute: async ({ query }) => {
    console.log(`\n🔍 Agent triggered searchDocumentation tool`);
    console.log(`   Query: "${query}"`);

    // Step 1: Embed the query with Voyage AI
    const queryEmbedding = await getQueryEmbedding(query);

    // Step 2: Run $vectorSearch on MongoDB Atlas
    console.log(`📡 Running $vectorSearch on brand_demo.brand_book`);
    const client = await clientPromise;
    const db = client.db("brand_demo");
    const collection = db.collection("brand_book");

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 15,
            limit: 5,
          },
        },
        {
          $project: {
            _id: 0,
            text: 1,
            section: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    console.log(`📄 Found ${results.length} relevant chunks (top score: ${results[0]?.score?.toFixed(2) ?? "N/A"})`);

    // Step 3: Return formatted results for the agent
    return results
      .map(
        (doc, i) =>
          `[${i + 1}] Section: ${doc.section} (relevance: ${(doc.score * 100).toFixed(0)}%)\n${doc.text}`
      )
      .join("\n\n---\n\n");
  },
});