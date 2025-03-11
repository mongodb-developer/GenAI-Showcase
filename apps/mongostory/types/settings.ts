export interface AIFeatureSettings {
  enabled: boolean
  config?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
}

export interface Settings {
  _id?: string // Make _id optional
  siteTitle: string
  description: string
  language: string
  timezone: string
  aiFeatures: {
    contentAnalysis: AIFeatureSettings
    seoOptimization: AIFeatureSettings
    qualityCheck: AIFeatureSettings
    emotionalImpact: AIFeatureSettings
    topicAnalysis: AIFeatureSettings
    autoTranslation: AIFeatureSettings
    contentSummarization: AIFeatureSettings
    tagRecommendation: AIFeatureSettings
    sentimentAnalysis: AIFeatureSettings
    abHeadlineTesting: AIFeatureSettings
  }
  integrations: {
    googleAnalytics?: string
    facebookPixel?: string
  }
  userRoles: Array<{
    id: number
    name: string
    permissions: string[]
  }>
}

