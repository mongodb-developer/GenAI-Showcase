import { getMemoriesCollection } from './mongodb';
import { GoogleGenAI } from '@google/genai';

export interface Memory {
  _id?: string;
  deploymentId: string;
  key: string;
  value: string;
  userCookie: string;
  isGlobal: boolean;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// VoyageAI embedding configuration
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3.5-lite'; // 1024 dimensions

// Generate embedding using VoyageAI
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_AI_API_KEY;
  if (!apiKey) {
    console.warn('VOYAGE_AI_API_KEY not set, skipping embedding generation');
    return [];
  }

  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: VOYAGE_MODEL,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('VoyageAI embedding error:', error);
      return [];
    }

    const data = await response.json();
    return data.data[0].embedding; // 1024-dim vector
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return [];
  }
}

// Classify memory as global or private using Gemini
async function classifyMemory(key: string, value: string): Promise<{
  isGlobal: boolean;
  processedValue: string;
  reasoning: string;
}> {
  const prompt = `Analyze this memory and classify it as GLOBAL (shared across all users) or PRIVATE (user-specific).

Key: ${key}
Value: ${value}

GLOBAL categories (shared across all users):
- Product information, pricing, features
- Company info, business hours, policies
- Factual data about services
- General knowledge the agent learned

PRIVATE categories (user-specific):
- User names, contact info, preferences
- Personal details, account info
- Session-specific data
- Individual user history

If GLOBAL and contains emails/phones, replace them with [EMAIL] or [PHONE].

Respond ONLY with valid JSON (no markdown):
{"isGlobal": boolean, "processedValue": "string with any PII obfuscated if global", "reasoning": "brief explanation"}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '{"isGlobal": false, "processedValue": "' + value + '", "reasoning": "Default to private"}';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Classification error:', error);
    return { isGlobal: false, processedValue: value, reasoning: 'Classification failed, defaulting to private' };
  }
}

export async function setMemory(
  deploymentId: string,
  userCookie: string,
  key: string,
  value: string
): Promise<{ success: boolean; isGlobal: boolean; reasoning: string }> {
  const collection = await getMemoriesCollection();

  // Classify the memory
  const classification = await classifyMemory(key, value);

  // Generate embedding for the memory content
  const embeddingText = `${key}: ${classification.processedValue}`;
  const embedding = await generateEmbedding(embeddingText);

  const now = new Date();
  const memory: Omit<Memory, '_id'> = {
    deploymentId,
    key,
    value: classification.processedValue,
    userCookie: classification.isGlobal ? 'global' : userCookie,
    isGlobal: classification.isGlobal,
    embedding: embedding.length > 0 ? embedding : undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Upsert: update if exists, insert if not
  const filter = classification.isGlobal
    ? { deploymentId, key, isGlobal: true }
    : { deploymentId, key, userCookie };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdAt, ...memoryWithoutCreatedAt } = memory;

  await collection.updateOne(
    filter,
    { $set: { ...memoryWithoutCreatedAt, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );

  return { success: true, isGlobal: classification.isGlobal, reasoning: classification.reasoning };
}

export async function getMemory(
  deploymentId: string,
  userCookie: string,
  key: string
): Promise<Memory | null> {
  const collection = await getMemoriesCollection();

  // Try user-specific first, then global
  const memory = await collection.findOne({
    deploymentId,
    key,
    $or: [{ userCookie }, { isGlobal: true }],
  }) as Memory | null;

  return memory;
}

export async function deleteMemory(
  deploymentId: string,
  userCookie: string,
  key: string
): Promise<{ success: boolean; deletedCount: number }> {
  const collection = await getMemoriesCollection();

  // Only delete user's own memories (not global ones unless they're the creator)
  const result = await collection.deleteOne({
    deploymentId,
    key,
    userCookie,
  });

  return { success: true, deletedCount: result.deletedCount };
}

export interface QueryResult {
  memories: Memory[];
  pipeline: object[];
  searchType: 'hybrid' | 'text' | 'regex';
}

export async function queryMemories(
  deploymentId: string,
  userCookie: string,
  query: string,
  limit: number = 10
): Promise<QueryResult> {
  const collection = await getMemoriesCollection();

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // If we have embeddings enabled, use hybrid search with $rankFusion
  if (queryEmbedding.length > 0) {
    const pipeline = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vectorSearch: [
                {
                  $vectorSearch: {
                    index: "memory_vector_index",
                    path: "embedding",
                    queryVector: `[${queryEmbedding.length} dimensions]`, // Truncate for display
                    numCandidates: 100,
                    limit: 30,
                    filter: {
                      $and: [
                        { deploymentId: deploymentId },
                        {
                          $or: [
                            { userCookie: userCookie },
                            { isGlobal: true }
                          ]
                        }
                      ]
                    }
                  }
                }
              ],
              textSearch: [
                {
                  $search: {
                    index: "memory_text_index",
                    compound: {
                      should: [
                        { text: { query: query, path: "key", fuzzy: {} } },
                        { text: { query: query, path: "value", fuzzy: {} } }
                      ]
                    }
                  }
                },
                {
                  $match: {
                    deploymentId: deploymentId,
                    $or: [
                      { userCookie: userCookie },
                      { isGlobal: true }
                    ]
                  }
                },
                { $limit: 30 }
              ]
            }
          },
          combination: {
            weights: { vectorSearch: 0.7, textSearch: 0.3 }
          }
        }
      },
      { $limit: limit }
    ];

    // Actual pipeline with real embedding
    const actualPipeline = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vectorSearch: [
                {
                  $vectorSearch: {
                    index: "memory_vector_index",
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 100,
                    limit: 30,
                    filter: {
                      $and: [
                        { deploymentId: deploymentId },
                        {
                          $or: [
                            { userCookie: userCookie },
                            { isGlobal: true }
                          ]
                        }
                      ]
                    }
                  }
                }
              ],
              textSearch: [
                {
                  $search: {
                    index: "memory_text_index",
                    compound: {
                      should: [
                        { text: { query: query, path: "key", fuzzy: {} } },
                        { text: { query: query, path: "value", fuzzy: {} } }
                      ]
                    }
                  }
                },
                {
                  $match: {
                    deploymentId: deploymentId,
                    $or: [
                      { userCookie: userCookie },
                      { isGlobal: true }
                    ]
                  }
                },
                { $limit: 30 }
              ]
            }
          },
          combination: {
            weights: { vectorSearch: 0.7, textSearch: 0.3 }
          }
        }
      },
      { $limit: limit }
    ];

    try {
      const memories = await collection.aggregate(actualPipeline).toArray();
      return {
        memories: memories as unknown as Memory[],
        pipeline,
        searchType: 'hybrid'
      };
    } catch (error) {
      console.warn('Hybrid search failed, falling back to text search:', error);
      // Fall through to fallback search
    }
  }

  // Fallback: text search or regex search
  const textSearchFilter = {
    deploymentId,
    $or: [{ userCookie }, { isGlobal: true }],
    $text: { $search: query },
  };

  try {
    const memories = await collection
      .find(textSearchFilter)
      .limit(limit)
      .toArray();

    return {
      memories: memories as unknown as Memory[],
      pipeline: [{ $match: textSearchFilter }, { $limit: limit }],
      searchType: 'text'
    };
  } catch {
    // Fallback to regex search if text index doesn't exist
    const regex = new RegExp(query.split(' ').join('|'), 'i');
    const regexFilter = {
      deploymentId,
      $and: [
        { $or: [{ userCookie }, { isGlobal: true }] },
        { $or: [{ key: regex.source }, { value: regex.source }] },
      ],
    };

    const memories = await collection
      .find({
        deploymentId,
        $and: [
          { $or: [{ userCookie }, { isGlobal: true }] },
          { $or: [{ key: regex }, { value: regex }] },
        ],
      })
      .limit(limit)
      .toArray();

    return {
      memories: memories as unknown as Memory[],
      pipeline: [{ $match: regexFilter }, { $limit: limit }],
      searchType: 'regex'
    };
  }
}

export async function listAllMemories(
  deploymentId: string,
  userCookie: string
): Promise<Memory[]> {
  const collection = await getMemoriesCollection();

  const memories = await collection
    .find({
      deploymentId,
      $or: [{ userCookie }, { isGlobal: true }],
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return memories as unknown as Memory[];
}
