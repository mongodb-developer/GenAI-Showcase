export interface Translation {
  title: string
  content: string
  createdAt: string
  lastUpdated?: string
  translatedBy: "AI" | "Human"
  status: "draft" | "published"
}

export interface Analysis {
  [key: string]: any
}

export interface ContentItem {
  _id: string
  title: string
  content: string
  status: "draft" | "published"
  author: string
  date: string
  publishedAt?: string
  aiFeatures: string[]
  analysis?: Analysis
  analysisOutdated?: boolean
  parentId?: string
  isRevision?: boolean
  revisionNote?: string
  translations?: {
    [key: string]: Translation
  }
}
