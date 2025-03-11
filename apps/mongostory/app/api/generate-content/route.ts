import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import { NextResponse } from "next/server"

type ExpertiseLevel = "student" | "mid-level" | "expert"

const expertiseLevelPrompts = {
  student:
    "Write in a clear, basic style suitable for beginners. Use simple explanations and avoid complex terminology. The content should be educational and easy to understand.",
  "mid-level":
    "Write in a balanced style with moderate technical depth. Include some industry-specific terms while maintaining accessibility. The content should be practical and application-focused.",
  expert:
    "Write in an advanced, sophisticated style with deep technical insights. Use industry-specific terminology and complex concepts. The content should be thorough and academically rigorous.",
}

const topicSuggestions = {
  student: [
    "Introduction to Web Development",
    "Getting Started with JavaScript",
    "Understanding HTML and CSS Basics",
    "Basic Programming Concepts",
    "Simple Project Tutorials",
  ],
  "mid-level": [
    "Building Scalable Web Applications",
    "Frontend Framework Comparisons",
    "Database Design Patterns",
    "API Development Best Practices",
    "Testing Methodologies",
  ],
  expert: [
    "Advanced System Architecture",
    "Microservices Design Patterns",
    "Distributed Systems Engineering",
    "Performance Optimization Techniques",
    "Security Implementation Strategies",
  ],
}

export async function POST(req: Request) {
  try {
    const { topic, expertiseLevel } = await req.json()
    const model = xai("grok-2-1212")

    // Generate title with a specific prompt for concise titles
    const { text: titleResponse } = await generateText({
      model,
      prompt: `Create a concise, engaging title (maximum 60 characters) for an article about ${topic}. 
The title should be appropriate for ${expertiseLevel} level readers.
Return ONLY the title, nothing else.

Example format:
"Building Scalable APIs with Node.js"

Generate title:`,
    })

    // Clean up the title - remove quotes and extra whitespace
    const title = titleResponse.replace(/^["']|["']$/g, "").trim()

    // Generate content
    const { text: content } = await generateText({
      model,
      prompt: `Write a comprehensive article in markdown format about ${topic}.
      ${expertiseLevelPrompts[expertiseLevel as ExpertiseLevel]}
      
      Include the following sections:
      - Introduction
      - Main concepts
      - Practical examples
      - Best practices
      - Conclusion
      
      Make sure to use proper markdown formatting with headings, lists, code blocks where appropriate, and emphasis.`,
    })

    // Generate suggested topics based on expertise level
    const suggestedTopics = topicSuggestions[expertiseLevel as ExpertiseLevel]

    return NextResponse.json({
      title,
      content: content.trim(),
      suggestedTopics,
    })
  } catch (error) {
    console.error("Error generating content:", error)
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}

