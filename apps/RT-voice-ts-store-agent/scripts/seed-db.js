#!/usr/bin/env node

/**
 * Seed Script for AI Shop Products and Index Creation
 *
 * This script loads product data from a JSON file, computes embeddings for each document
 * using the Vercel AI SDK, seeds (upserts) each document into the "products" collection in the
 * "ai_shop" database, and then creates both an Atlas Search index and a vector search index.
 *
 * It uses a dedicated MongoDB client instance created with custom appName settings.
 *
 * Ensure you have the MONGODB_URI variable set in your .env file.
 * The product data file should be located at: ../data/ai_shop.products.json (relative to this script's directory)
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { openai } = require('@ai-sdk/openai');
const { embed } = require('ai');

/**
 * Computes the embedding for a given text using the Vercel AI SDK.
 * Uses the OpenAI embedding model 'text-embedding-3-small'.
 */
async function getEmbedding(text) {
  const result = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text
    // Optionally, configure maxRetries, timeout, etc.
  });
  return result.embedding;
}

async function loadProducts() {
  const dataFilePath = path.join(__dirname, "..", "data", "ai_shop.products.json");
  const fileData = await fs.readFile(dataFilePath, 'utf8');
  const products = JSON.parse(fileData);
  return products;
}

async function seedProducts(client) {
  // Load products from JSON file
  const products = await loadProducts();

  // Compute embeddings for each product if not already present and convert _id format
  for (const product of products) {
    if (!product.embeddings || (Array.isArray(product.embeddings) && product.embeddings.length === 0)) {
      const textToEmbed = product.title + " " + product.description;
      try {
        product.embeddings = await getEmbedding(textToEmbed);
      } catch (error) {
        console.error(`Failed to generate embedding for product "${product.title}":`, error);
      }
    }
    if (product._id && product._id.$oid) {
      product._id = new ObjectId(product._id.$oid);
    }
  }

  const db = client.db("ai_shop");
  const collection = db.collection('products');

  // Upsert each product document
  for (const product of products) {
    const filter = product._id ? { _id: product._id } : { title: product.title };
    await collection.updateOne(filter, { $set: product }, { upsert: true });
    console.log(`Upserted product: ${product.title}`);
  }
}

async function createSearchIndex(client) {
  try {
    const db = client.db("ai_shop");
    try {
      await db.collection("products").dropIndexes();
      console.log("Dropped existing indexes on 'products' collection");
    } catch (e) {
      console.log("No indexes dropped or error ignored:", e.message);
    }
    await db.command({
      createSearchIndexes: "products",
      indexes: [{
        name: "default",
        definition: {
          mappings: {
            dynamic: true
          }
        }
      }]
    });
    console.log("Successfully created Atlas Search index on 'products' collection");
  } catch (e) {
    console.error("Failed to create search index:", e);
  }
}

async function createVectorIndex(client) {
  try {
    const db = client.db("ai_shop");
    await db.command({
      createSearchIndexes: "products",
      indexes: [{
        name: "vector_index",
        type: "vectorSearch",
        definition: {
          fields: [{
            type: "vector",
            numDimensions: 1536,
            path: "embeddings",
            similarity: "cosine"
          }]
        }
      }]
    });
    console.log("Successfully created vector search index on 'products' collection");
  } catch (e) {
    console.error("Failed to create vector index:", e);
  }
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not defined in the .env file.");
    process.exit(1);
  }
  // Use a dedicated client with a custom appName
  const client = new MongoClient(uri, { appName: "devrel.genaishowcase.rt-openai-ts" });
  try {
    await client.connect();
    await seedProducts(client);
    // After seeding, create the indexes
    await createSearchIndex(client);
    await createVectorIndex(client);
  } catch (err) {
    console.error("Error during seeding/index creation:", err);
  } finally {
    await client.close();
  }
}

run().then(() => {
  console.log("Seeding and index creation script completed.");
}).catch(err => {
  console.error("Error running seeding script:", err);
  process.exit(1);
});
