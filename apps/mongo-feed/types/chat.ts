export interface ChatMessage {
  id: string
  role: "Customer" | "Agent"
  content: string
  timestamp: Date
  sentiment: "positive" | "negative" | "neutral"
  topics: string[]
  category: string
  agentName?: string
}

export interface ProcessedChat {
  id: string
  messages: ChatMessage[]
  analysis: {
    overallSentiment: "positive" | "negative" | "neutral"
    mainTopics: string[]
    agentName?: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface ChatAnalysis {
  sentiment: string
  topics: string[]
  category: string
  agentName: string | null
}

