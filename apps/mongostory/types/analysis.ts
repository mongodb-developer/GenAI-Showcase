export interface Analysis {
  analyses: {
    seo: {
      title: string
      description: string
      keywords: string[]
      score: number
      improvements: string[]
    }
    quality: {
      readabilityScore: number
      clarity: number
      structure: number
      suggestions: string[]
      strengths: string[]
    }
    emotional: {
      primaryEmotion: string
      emotionBreakdown: Array<{ emotion: string; percentage: number }>
      tone: string
      engagement: number
    }
    topic: {
      mainTopics: string[]
      relevanceScore: number
      suggestedTopics: string[]
      audienceMatch: string
    }
  }
  summary: string
}
