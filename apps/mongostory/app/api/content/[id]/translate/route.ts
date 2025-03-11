import { NextResponse } from "next/server"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const SUPPORTED_LANGUAGES = {
  fr: "French",
  de: "German",
  es: "Spanish",
  cn: "Chinese",
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { targetLanguage } = await req.json()

    if (!Object.keys(SUPPORTED_LANGUAGES).includes(targetLanguage)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    const content = await db.collection("content").findOne({
      _id: new ObjectId(params.id),
    })

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 })
    }

    // Check if translation already exists
    if (content.translations?.[targetLanguage]) {
      return NextResponse.json({ message: "Translation already exists" }, { status: 200 })
    }

    const model = xai("grok-2-1212")

    // Translate title
    const { text: translatedTitle } = await generateText({
      model,
      prompt: `Translate the following title to ${SUPPORTED_LANGUAGES[targetLanguage]}:
      
Original: ${content.title}

Provide ONLY the translated text, nothing else.`,
    })

    // Translate content
    const { text: translatedContent } = await generateText({
      model,
      prompt: `Translate the following content to ${SUPPORTED_LANGUAGES[targetLanguage]}. 
Maintain all markdown formatting:

Original:
${content.content}

Provide ONLY the translated text, nothing else.`,
    })

    // Update the document with the new translation
    const result = await db.collection("content").updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          [`translations.${targetLanguage}`]: {
            title: translatedTitle.trim(),
            content: translatedContent.trim(),
            createdAt: new Date().toISOString(),
          },
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Failed to save translation" }, { status: 500 })
    }

    return NextResponse.json({
      title: translatedTitle.trim(),
      content: translatedContent.trim(),
    })
  } catch (error) {
    console.error("Error translating content:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to translate content" },
      { status: 500 },
    )
  }
}

