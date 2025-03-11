"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, Search, Heart, Target, RefreshCcw, Loader2 } from "lucide-react"
import { Markdown } from "@/components/ui/markdown"
import { LanguageSelector } from "./language-selector"
import type { ContentItem } from "@/types/content"
import { useState } from "react"

interface ContentPreviewTabsProps {
  content: ContentItem
  initialLanguage?: string
  onReviseWithAI?: (contentId: string) => Promise<void>
  isRevising?: boolean
  setContent?: any
  toast?: any
}

export function ContentPreviewTabs({
  content,
  initialLanguage = "en",
  onReviseWithAI,
  isRevising,
  setContent,
  toast,
}: ContentPreviewTabsProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage)
  const translation = selectedLanguage !== "en" ? content.translations?.[selectedLanguage] : null
  const availableLanguages = ["en", ...(content.translations ? Object.keys(content.translations) : [])]

  const currentTitle = translation?.title || content.title
  const currentContent = translation?.content || content.content

  const analysis = content.analysis?.analyses
  const summary = content.analysis?.summary

  // Update the onReviseWithAI prop to use the new endpoint
  const handleReviseWithAI = async (contentId: string) => {
    setIsRevising(contentId)
    try {
      const response = await fetch(`/api/content/${contentId}/ai-revise`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to revise content")
      }

      const revisedContent = await response.json()
      setContent((prev) => [revisedContent, ...prev])
      toast({
        title: "Success",
        description: "Content revised successfully with AI recommendations.",
      })
    } catch (error) {
      console.error("Error revising content:", error)
      toast({
        title: "Error",
        description: "Failed to revise content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRevising(null)
    }
  }

  const [isRevisingState, setIsRevising] = useState<string | null>(null)

  return (
    <Tabs defaultValue="preview" className="w-full">
      <div className="flex justify-between items-center mb-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
        </TabsList>
        <LanguageSelector
          currentLanguage={selectedLanguage}
          availableLanguages={availableLanguages}
          onLanguageChange={setSelectedLanguage}
        />
      </div>

      <TabsContent value="preview" className="mt-0">
        <Card>
          <CardContent className="pt-6">
            <article className="prose dark:prose-invert max-w-none">
              <h1 className="text-3xl font-bold tracking-tight mb-4">{currentTitle}</h1>
              <Markdown>{currentContent}</Markdown>
            </article>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ai-insights" className="mt-0 space-y-8">
        {/* Executive Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Executive Summary</h2>
              {onReviseWithAI && (
                <Button
                  variant="default"
                  onClick={() => handleReviseWithAI(content._id)}
                  disabled={isRevisingState !== null}
                  className="ml-auto"
                >
                  {isRevisingState === content._id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Revising with AI...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Apply Recommendations
                    </>
                  )}
                </Button>
              )}
            </div>
            {summary && <Markdown>{summary}</Markdown>}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* SEO Analysis */}
          {analysis?.seo && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">SEO Analysis</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">SEO Score</span>
                      <span className="font-bold">{analysis.seo.score}/10</span>
                    </div>
                    <Progress value={analysis.seo.score * 10} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Suggested Title</h4>
                    <p className="text-sm bg-secondary/50 p-2 rounded">{analysis.seo.title}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.seo.keywords.map((keyword, i) => (
                        <Badge key={i} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quality Analysis */}
          {analysis?.quality && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Quality Analysis</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">{analysis.quality.readabilityScore}</div>
                      <div className="text-sm text-muted-foreground">Readability</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">{analysis.quality.clarity}</div>
                      <div className="text-sm text-muted-foreground">Clarity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1">{analysis.quality.structure}</div>
                      <div className="text-sm text-muted-foreground">Structure</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Strengths</h4>
                    <ul className="list-disc pl-4 text-sm space-y-1">
                      {analysis.quality.strengths.map((strength, i) => (
                        <li key={i}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Emotional Analysis */}
          {analysis?.emotional && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Emotional Analysis</h3>
                </div>
                <div className="space-y-4">
                  <div className="bg-secondary/50 p-3 rounded">
                    <div className="text-sm text-muted-foreground mb-1">Primary Emotion</div>
                    <div className="text-lg font-semibold">{analysis.emotional.primaryEmotion}</div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Emotion Breakdown</h4>
                    <div className="space-y-2">
                      {analysis.emotional.emotionBreakdown.map((emotion, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{emotion.emotion}</span>
                            <span>{emotion.percentage}%</span>
                          </div>
                          <Progress value={emotion.percentage} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Topic Analysis */}
          {analysis?.topic && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Topic Analysis</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">Relevance Score</span>
                      <span className="font-bold">{analysis.topic.relevanceScore}/10</span>
                    </div>
                    <Progress value={analysis.topic.relevanceScore * 10} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Main Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.topic.mainTopics.map((topic, i) => (
                        <Badge key={i} variant="secondary">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Suggested Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.topic.suggestedTopics.map((topic, i) => (
                        <Badge key={i} variant="outline">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

