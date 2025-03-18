"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeBlock } from "./code-block"
import { FileText, MessageSquare, BarChart2, Settings, Users, Clock, Database } from "lucide-react"

const schemaExamples = {
  content: {
    icon: <FileText className="h-5 w-5" />,
    title: "Content Collection",
    description: "Stores all content items including articles, posts, and their translations",
    schema: `{
  _id: ObjectId,
  title: String,
  content: String,
  status: "draft" | "published",
  author: String,
  date: ISODate,
  publishedAt?: ISODate,
  aiFeatures: String[],
  translations: {
    [language: string]: {
      title: String,
      content: String,
      createdAt: ISODate,
      lastUpdated?: ISODate,
      translatedBy: "AI" | "Human",
      status: "draft" | "published"
    }
  },
  analysis?: {
    summary: String,
    analyses: {
      seo: {
        title: String,
        description: String,
        keywords: String[],
        score: Number,
        improvements: String[]
      },
      quality: {
        readabilityScore: Number,
        clarity: Number,
        structure: Number,
        suggestions: String[],
        strengths: String[]
      },
      emotional: {
        primaryEmotion: String,
        emotionBreakdown: Array<{
          emotion: String,
          percentage: Number
        }>,
        tone: String,
        engagement: Number
      },
      topic: {
        mainTopics: String[],
        relevanceScore: Number,
        suggestedTopics: String[],
        audienceMatch: String
      }
    }
  },
  parentId?: ObjectId,
  isRevision?: Boolean,
  revisionNote?: String
}`,
    example: `// Find content with specific language translations
db.content.find({
  "translations.fr": { $exists: true }
})

// Get content with all its translations
db.content.findOne({
  _id: ObjectId("contentId")
}, {
  title: 1,
  content: 1,
  translations: 1
})

// Update a specific translation
db.content.updateOne(
  { _id: ObjectId("contentId") },
  {
    $set: {
      "translations.fr": {
        title: "Nouveau titre",
        content: "Contenu en français",
        createdAt: new Date(),
        translatedBy: "AI",
        status: "published"
      }
    }
  }
)`,
  },
  analytics: {
    icon: <BarChart2 className="h-5 w-5" />,
    title: "Analytics Collections",
    description: "Multiple collections for tracking various analytics metrics",
    schema: `// Page Views Collection
{
  _id: ObjectId,
  contentId: ObjectId,
  timestamp: ISODate,
  visitorId: String,
  duration: Number
}

// Unique Visitors Collection
{
  _id: ObjectId,
  visitorId: String,
  firstVisit: ISODate,
  lastVisit: ISODate,
  totalVisits: Number
}

// Sessions Collection
{
  _id: ObjectId,
  visitorId: String,
  duration: Number,
  timestamp: ISODate,
  pages: [{
    contentId: ObjectId,
    duration: Number
  }]
}`,
    example: `// Get page views over time
db.pageViews.aggregate([
  { $group: {
      _id: {
        $dateToString: {
          format: "%Y-%m-%d",
          date: "$timestamp"
        }
      },
      views: { $sum: 1 }
  }},
  { $sort: { _id: 1 } }
])`,
  },
  socialMedia: {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Social Media Posts Collection",
    description: "Tracks social media posts and their performance metrics",
    schema: `{
  _id: ObjectId,
  contentId: ObjectId,
  platform: String,
  content: String,
  publishedAt: ISODate,
  stats: {
    likes: Number,
    shares: Number,
    comments: Number,
    engagementScore: Number
  }
}`,
    example: `// Get social media performance by content
db.socialMediaPosts.aggregate([
  { $group: {
      _id: "$contentId",
      totalEngagement: {
        $sum: {
          $add: ["$stats.likes", "$stats.shares", "$stats.comments"]
        }
      }
  }}
])`,
  },
  settings: {
    icon: <Settings className="h-5 w-5" />,
    title: "Settings Collection",
    description: "Application settings and AI feature configurations",
    schema: `{
  _id: ObjectId,
  siteTitle: String,
  description: String,
  language: String,
  timezone: String,
  aiFeatures: {
    contentAnalysis: { enabled: Boolean },
    seoOptimization: { enabled: Boolean },
    qualityCheck: { enabled: Boolean },
    emotionalImpact: { enabled: Boolean },
    topicAnalysis: { enabled: Boolean },
    autoTranslation: { enabled: Boolean },
    contentSummarization: { enabled: Boolean },
    tagRecommendation: { enabled: Boolean },
    sentimentAnalysis: { enabled: Boolean },
    abHeadlineTesting: { enabled: Boolean }
  },
  integrations: {
    googleAnalytics?: String,
    facebookPixel?: String
  }
}`,
    example: `// Get enabled AI features
db.settings.findOne({}, {
  aiFeatures: {
    $filter: {
      input: { $objectToArray: "$aiFeatures" },
      cond: { $eq: ["$$this.v.enabled", true] }
    }
  }
})`,
  },
  users: {
    icon: <Users className="h-5 w-5" />,
    title: "User Roles Collection",
    description: "User roles and permissions management",
    schema: `{
  _id: ObjectId,
  name: String,
  permissions: String[],
  createdAt: ISODate,
  updatedAt: ISODate
}`,
    example: `// Find users with specific permissions
db.userRoles.find({
  permissions: {
    $all: ["create", "publish"]
  }
})`,
  },
  audit: {
    icon: <Clock className="h-5 w-5" />,
    title: "Audit Log Collection",
    description: "Tracks important system events and changes",
    schema: `{
  _id: ObjectId,
  action: String,
  entityType: String,
  entityId: ObjectId,
  userId: ObjectId,
  timestamp: ISODate,
  changes: {
    before: Object,
    after: Object
  }
}`,
    example: `// Get recent content changes
db.auditLog.find({
  entityType: "content",
  action: "update"
}).sort({ timestamp: -1 })`,
  },
}

export function MongoDBSchemaViewer() {
  const [activeTab, setActiveTab] = useState("content")

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">MongoStroy Data Model</h1>
          <p className="text-muted-foreground">
            Explore how MongoStroy uses MongoDB to store and manage content, analytics, and system configurations. Each
            collection is designed for specific functionality while maintaining relationships between data.
          </p>
        </div>

        <Tabs defaultValue="content" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 mb-8">
            {Object.entries(schemaExamples).map(([key, { icon, title }]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                {icon}
                <span className="hidden md:inline">{title.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(schemaExamples).map(([key, { title, description, schema, example }]) => (
            <TabsContent key={key} value={key}>
              <Card>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Schema</h3>
                    <CodeBlock code={schema} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Example Query</h3>
                    <CodeBlock code={example} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Data Model Relationships Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full bg-muted/20 rounded-md flex items-center justify-center mb-4">
              <div className="text-center">
                <Database className="h-12 w-12 text-primary/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Interactive MongoDB schema visualization will be available here</p>
              </div>
            </div>
            <div className="prose dark:prose-invert">
              <ul>
                <li>
                  <strong>Content & Revisions:</strong> Uses a self-referential relationship with <code>parentId</code>{" "}
                  to track content versions
                </li>
                <li>
                  <strong>Content & Analytics:</strong> Page views and engagement metrics are linked to content via{" "}
                  <code>contentId</code>
                </li>
                <li>
                  <strong>Content & Social Media:</strong> Social posts reference their source content for tracking
                  cross-platform performance
                </li>
                <li>
                  <strong>Users & Content:</strong> Content items track their authors and maintain access control
                  through user roles
                </li>
                <li>
                  <strong>Audit Trail:</strong> All significant changes are logged with references to the affected
                  entities and users
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
