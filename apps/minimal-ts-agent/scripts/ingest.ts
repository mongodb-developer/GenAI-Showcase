import { MongoClient } from "mongodb";

// ============================================================
// MongoDB Brand Book — Tone of Voice (chunked by section)
// ============================================================
const brandBookChunks = [
  {
    section: "Overview",
    text: `An important way we bring the MongoDB brand to life is through our captivating and inspiring written content – which is constantly shaped by our tone of voice and writing guidelines. Our tone of voice should be flexible enough to adjust depending on a certain situation. Our writing style should always remain broadly the same. How we write is formed by a series of rules and guidelines that form the basis for all the content we create.`,
  },
  {
    section: "How We Sound — Overview",
    text: `Our tone of voice dictates how we sound across every interaction with our audience. We like to think of it as the fabric that holds our brand together, which is flexible enough that it can adapt and shift to speak to different audiences according to where they are on the MongoDB journey. It is shaped around four distinct characteristics: Human, Straightforward, Bold, and Positive.`,
  },
  {
    section: "How We Sound — Human",
    text: `Our tone is conversational and human, with an authenticity that our audience recognizes and relates to. We sound honest and approachable, like a trusted friend, while remaining inclusive in every sense of the word – able to speak to different languages and skill levels. Key words: Empathetic, Reassuring, Natural, Honest, Relaxed, Fresh, Personable. Example: Instead of "The document data model provides everything a developer could need," try "Our document data model is simple to learn, and easy to use, with all the capabilities developers need to meet even the most complex of requirements."`,
  },
  {
    section: "How We Sound — Straightforward",
    text: `When we speak, we get straight to the point, talking with clarity and precision about even the most complex of subjects. Our voice is up-front and informative, focused on the details in a way that is clear and direct, so we can guide our audience to exactly what they want to know. Key words: Simple, Focused, Frictionless, Direct, To-the-point, Up-front. Example: Instead of "With our advanced platform you can build applications on multiple cloud platforms at the same time," try "Our powerful, multi-cloud platform enables you to build, deploy, and iterate applications across AWS, Azure, and Google Cloud, while growing quickly at scale across multiple regions."`,
  },
  {
    section: "How We Sound — Bold",
    text: `Our tone of voice carries the courage and conviction of industry pioneers, who are never afraid to tackle the big issues head on. We always speak with authority and expertise, standing up for what we believe without confrontation, while challenging others to do the same. Key words: Authority, Pioneering, Courage, Bravery, Expertise, Leadership. Example: Instead of "Our data platform is designed to give you all the flexibility you could need," try "MongoDB provides companies with the industry's first application data platform that allows them to move fast and simplify how they build with data for any application."`,
  },
  {
    section: "How We Sound — Positive",
    text: `It's through our passionate and optimistic tone of voice that we empower and motivate everyone around us. Our voice carries a natural and vibrant energy, a rallying cry that is positive and hopeful, always looking to lead by example and point to the way forward. Key words: Energetic, Lively, Optimistic, Infectious, Inspiring, Rallying, Hopeful. Example: Instead of "Our cloud-native database provides a comprehensive suite of out-the-box tools," try "Not only have we built the world's most powerful cloud-native database, but we've provided developers everywhere with a revolutionary platform equipped with all the tools they could need to change the world through the power of data."`,
  },
  {
    section: "How We Write — Overview",
    text: `The guiding principles of our writing help shape the MongoDB brand. They should be used to influence and rationalize every piece of content we create in order to ensure that we are communicating a compelling and consistent message across multiple different audiences. Our writing is formed around four key guidelines: We're active and engaging, We're technical — when we need to be, We're timely and relevant, We focus on outcomes and results.`,
  },
  {
    section: "How We Write — Active and Engaging",
    text: `We always talk directly to our audience in an active and engaging manner, imagining our readers and their precise needs as we write. It helps us communicate clearly and effectively, and create a captivating message that our audience can relate to and feel inspired by. Guidelines: Use short, concise sentence structures to increase understanding. Avoid long lists of features — instead craft a message that appeals to your audience. When we write, we write with an active voice.`,
  },
  {
    section: "How We Write — Technical When Needed",
    text: `Our audience expects us to talk to them at their level, and sometimes that level can be very technical. That's why we carefully consider exactly who we are talking to, adapting our writing depending on where the user is on the journey, and letting our expertise shine through but easing them into it so we don't overwhelm them with our technical prowess. Guidelines: Consider non-technical language to connect to users higher in the funnel. Get technical — but always at the right moment. Adapt your language to the user journey. Let our industry expertise shine through, when the time is right.`,
  },
  {
    section: "How We Write — Timely and Relevant",
    text: `We work in an industry that is constantly changing, where what's new today can often be dated by tomorrow. That's why the way we write must feel of-the-moment, tapping into the direction the industry and the world is heading in, always with one eye on the future. Guidelines: Send the right message, at the right time. Consider your audience's current needs and opinions. Write with the future in mind. Ensure you write to current events and trends.`,
  },
  {
    section: "How We Write — Outcomes and Results",
    text: `Always make sure your writing is driven by the outcomes and results of MongoDB, leading with your audience's specific needs throughout. By focusing on the "why" and the "how," we're able to craft a more compelling message that resonates with the reader. Guidelines: Don't just describe, but focus on clear benefits for the reader. Add supporting details, stats and information that back up our claims. Talk about what was made and how MongoDB made an impact. Avoid long lists of product features. Craft an appealing message around why MongoDB is the best.`,
  },
  {
    section: "Grammar — Name Usage",
    text: `When using our name, we should always use the full version: MongoDB. While we may refer to ourselves internally as Mongo in a more informal way, it's important to keep in mind that in some regions this shortened version may carry negative connotations. So to be on the safe side, always stick to MongoDB. When writing about our wide range of tools and products, we always try to use their name in full.`,
  },
  {
    section: "Grammar — Jargon and Headers",
    text: `As a tech company, it goes without saying that we often use a lot of industry jargon in our writing. However, every care must be taken to ensure we use such terminology consistently, and that we don't invent jargon internally that might not be known to a wider audience. Use: Document data model (not document model, document database model, etc.). Use: Application data platform (not database platform, data platform, etc). We make use of headers and headlines formatted consistently, in sentence case, and without a period at the end of a sentence.`,
  },
  {
    section: "Grammar — Spelling and Commas",
    text: `When creating content for the MongoDB website, we always write in English, using proper American English spellings and punctuation. E.g., Color, not Colour; Itemized, not itemised; Program, not Programme. However, for other content, we should always keep in mind the specific region we are writing to. Across all of our communications, whenever we create a list, we use the Oxford (or serial) comma. E.g., "Experience unmatched data distribution and mobility across AWS, Azure, and Google Cloud."`,
  },
  {
    section: "Grammar — Humor",
    text: `Like many brands, we do have a sense of humor, but you should always pick just the right moment to make a joke, use an emoji, or lean into our tech culture in a more light-hearted way. If you're not sure if the moment is quite right, then it probably isn't — so just play it safe instead! Example: "What do you get when you combine @Github actions with Realm's new code deployment features? A CI/CD pipeline!" Example: "Mark your calendars to learn how to charm the snake and get beautiful document databases into MongoDB Atlas!"`,
  },
];

// ============================================================
// Voyage AI embedding helper
// ============================================================
async function getEmbeddings(
  texts: string[],
  model: string = "voyage-4-large"
): Promise<number[][]> {
  const VOYAGE_AI_API_KEY = process.env.VOYAGE_AI_API_KEY;
  if (!VOYAGE_AI_API_KEY) {
    throw new Error("VOYAGE_AI_API_KEY is not set");
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_AI_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} — ${error}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

// ============================================================
// Main ingestion
// ============================================================
async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  console.log(`📄 Preparing ${brandBookChunks.length} brand book chunks...`);

  // Generate embeddings
  console.log(`🧠 Generating embeddings with Voyage AI (voyage-4-large)...`);
  const texts = brandBookChunks.map((chunk) => chunk.text);
  const embeddings = await getEmbeddings(texts, "voyage-4-large");
  console.log(`✅ Generated ${embeddings.length} embeddings (${embeddings[0].length} dimensions)`);

  // Build documents
  const documents = brandBookChunks.map((chunk, i) => ({
    text: chunk.text,
    section: chunk.section,
    source: "MongoDB Brand Book — Tone of Voice",
    embedding: embeddings[i],
  }));

  // Insert into MongoDB
  console.log(`📡 Connecting to MongoDB Atlas...`);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db("brand_demo");
  const collection = db.collection("brand_book");

  // Clear existing data
  await collection.deleteMany({});
  console.log(`🗑️  Cleared existing documents`);

  // Insert new documents
  const result = await collection.insertMany(documents);
  console.log(`✅ Ingested ${result.insertedCount} documents into brand_demo.brand_book`);

  // Create Vector Search index (if it doesn't already exist)
  console.log(`🔎 Checking for existing vector search index...`);
  const existingIndexes = await collection.listSearchIndexes().toArray();
  const hasVectorIndex = existingIndexes.some((idx) => idx.name === "vector_index");

  if (hasVectorIndex) {
    console.log(`✅ Vector search index "vector_index" already exists — skipping creation`);
  } else {
    console.log(`🔨 Creating vector search index "vector_index"...`);
    await collection.createSearchIndex({
      name: "vector_index",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: embeddings[0].length,
            similarity: "cosine",
          },
        ],
      },
    });
    console.log(`✅ Vector search index created (${embeddings[0].length} dimensions, cosine)`);
    console.log(`   Note: The index may take a minute to become ready on Atlas`);
  }

  await client.close();
  console.log(`\n🎉 Done! Your RAG agent is ready to go.`);
}

main().catch(console.error);