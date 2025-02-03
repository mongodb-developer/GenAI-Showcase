#!/usr/bin/env ts-node

/**
 * MongoDB Seed Script for AI Shop Products
 *
 * This script loads product data from a JSON file, computes embeddings for each document 
 * using the title and description with the Vercel AI SDK, and then upserts each document 
 * into the MongoDB collection.
 *
 * It uses the MongoDB client from the project's lib/mongodb.ts file.
 *
 * Ensure you have the following environment variable set in your .env file:
 *   - MONGODB_URI
 *
 * The product data file should be located at:
 *   ./data/ai_shop.products.json
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';
import clientPromise from './lib/mongodb';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Computes the embedding for a given text using the Vercel AI SDK.
 * Uses the OpenAI embedding model 'text-embedding-3-small'.
 */
async function getEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
    // Optionally, you can configure maxRetries, timeout, etc.
  });
  return embedding;
}

async function loadProducts(): Promise<any[]> {
  const dataFilePath = path.join(__dirname, 'data', 'ai_shop.products.json');
  const fileData = await fs.readFile(dataFilePath, 'utf8');
  const products = JSON.parse(fileData);
  return products;
}

async function seedProducts() {
  // Load products from JSON file
  const products = await loadProducts();

  // Compute embeddings for each product if not already present
  for (const product of products) {
    if (!product.embeddings || (Array.isArray(product.embeddings) && product.embeddings.length === 0)) {
      const textToEmbed = `${product.title} ${product.description}`;
      try {
        product.embeddings = await getEmbedding(textToEmbed);
      } catch (error) {
        console.error(`Failed to generate embedding for product "${product.title}":`, error);
      }
    }
    // Convert _id from { "$oid": "..." } to ObjectId if necessary
    if (product._id && product._id.$oid) {
      product._id = new ObjectId(product._id.$oid);
    }
  }

  // Use the MongoDB client from lib/mongodb.ts
  const client = await clientPromise;
  const db = client.db("ai_shop"); // Uses the database specified in the connection string
  const collection = db.collection('products');

  // Upsert each product document
  for (const product of products) {
    const filter = product._id ? { _id: product._id } : { title: product.title };
    await collection.updateOne(filter, { $set: product }, { upsert: true });
    console.log(`Upserted product: ${product.title}`);
  }
}

seedProducts()
  .then(() => {
    console.log('Seeding completed.');
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
