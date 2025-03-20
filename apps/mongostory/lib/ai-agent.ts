import { xai } from "@ai-sdk/xai"
import { generateText, generateObject } from "ai"
import { z } from "zod"
import clientPromise from "@/lib/mongodb"

// Helper function to clamp number within range
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max)

// Define schemas for each analyzer
const SeoAnalysisSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  score: z.number().transform((val) => clamp(val, 1, 10)),
  improvements: z.array(z.string()),
  suggestions: z.array(z.string()), // Added suggestions array
})

const ContentQualitySchema = z.object({
  readabilityScore: z.number().transform((val) => clamp(val, 1, 10)),
  clarity: z.number().transform((val) => clamp(val, 1, 10)),
  structure: z.number().transform((val) => clamp(val, 1, 10)),
  suggestions: z.array(z.string()),
  strengths: z.array(z.string()),
})

const EmotionalImpactSchema = z.object({
  primaryEmotion: z.string(),
  emotionBreakdown: z.array(
    z.object({
      emotion: z.string(),
      percentage: z.number().transform((val) => clamp(val, 0, 100)),
    }),
  ),
  tone: z.string(),
  engagement: z.number().transform((val) => clamp(val, 1, 10)),
  suggestions: z.array(z.string()), // Added suggestions array
})

const TopicRelevanceSchema = z.object({
  mainTopics: z.array(z.string()),
  relevanceScore: z.number().transform((val) => clamp(val, 1, 10)),
  suggestedTopics: z.array(z.string()),
  audienceMatch: z.string(),
  suggestions: z.array(z.string()), // Added suggestions array
})

async function getEnabledFeatures() {
  const client = await clientPromise
  const db = client.db("mongostory")
  const settings = await db.collection("settings").findOne({})

  if (!settings) {
    return {
      seoOptimization: true,
      qualityCheck: true,
      emotionalImpact: true,
      topicAnalysis: true,
    }
  }

  return {
    seoOptimization: settings.aiFeatures.seoOptimization.enabled,
    qualityCheck: settings.aiFeatures.qualityCheck.enabled,
    emotionalImpact: settings.aiFeatures.emotionalImpact.enabled,
    topicAnalysis: settings.aiFeatures.topicAnalysis.enabled,
  }
}

export async function analyzeContent(content: string, title: string, selectedFeatures: string[]) {
  const model = xai("grok-2-1212")
  const enabledFeatures = await getEnabledFeatures()
  const analysisPromises = []

  // First, analyze the title separately
  const titleAnalysis = await generateText({
    model,
    system: "You are a title optimization expert. Create a concise, engaging title.",
    prompt: `Create an optimized title for this content. Keep it under 60 characters, make it engaging and SEO-friendly.
    Current title: ${title}
    Content excerpt: ${content.substring(0, 500)}...

    Return ONLY the optimized title, nothing else.`,
  })

  if (selectedFeatures.includes("SEO Optimization") && enabledFeatures.seoOptimization) {
    analysisPromises.push(
      generateObject({
        model,
        system: "You are an SEO expert. Analyze content for search engine optimization.",
        schema: SeoAnalysisSchema,
        prompt: `Analyze this content for SEO:
          Title: ${title}
          Content: ${content}

          Provide specific, actionable suggestions for SEO improvement.`,
      }),
    )
  }

  if (selectedFeatures.includes("Quality Check") && enabledFeatures.qualityCheck) {
    analysisPromises.push(
      generateObject({
        model,
        system: "You are a content quality expert. Evaluate writing quality and structure.",
        schema: ContentQualitySchema,
        prompt: `Evaluate the quality of this content:
          ${content}

          Focus on readability, clarity, and structure. Provide specific suggestions for improvement.`,
      }),
    )
  }

  if (selectedFeatures.includes("Emotional Impact") && enabledFeatures.emotionalImpact) {
    analysisPromises.push(
      generateObject({
        model,
        system: "You are an emotional intelligence expert. Analyze content tone and emotional impact.",
        schema: EmotionalImpactSchema,
        prompt: `Analyze the emotional impact of this content:
          ${content}

          Provide specific suggestions for improving emotional engagement.`,
      }),
    )
  }

  if (selectedFeatures.includes("Topic Analysis") && enabledFeatures.topicAnalysis) {
    analysisPromises.push(
      generateObject({
        model,
        system: "You are a topic relevance expert. Analyze content focus and audience match.",
        schema: TopicRelevanceSchema,
        prompt: `Analyze the topic relevance of this content:
          ${content}

          Provide specific suggestions for improving topic coverage and relevance.`,
      }),
    )
  }

  const analysisResults = await Promise.all(analysisPromises)

  const analyses = {
    seo: analysisResults.find((result) => result.object.hasOwnProperty("score"))?.object || null,
    quality: analysisResults.find((result) => result.object.hasOwnProperty("readabilityScore"))?.object || null,
    emotional: analysisResults.find((result) => result.object.hasOwnProperty("primaryEmotion"))?.object || null,
    topic: analysisResults.find((result) => result.object.hasOwnProperty("mainTopics"))?.object || null,
  }

  // Generate executive summary with all suggestions
  const allSuggestions = [
    ...(analyses.seo?.suggestions || []),
    ...(analyses.quality?.suggestions || []),
    ...(analyses.emotional?.suggestions || []),
    ...(analyses.topic?.suggestions || []),
  ]

  const { text: summary } = await generateText({
    model,
    system: "You are a content strategist summarizing content analysis.",
    prompt: `Provide a concise summary of these content analyses with key recommendations:
    ${JSON.stringify(analyses, null, 2)}

    Include specific, actionable suggestions for improvement.

    Additional suggestions to incorporate:
    ${allSuggestions.join("\n")}`,
  })

  return {
    optimizedTitle: titleAnalysis.text.trim(),
    analyses,
    summary,
  }
}
