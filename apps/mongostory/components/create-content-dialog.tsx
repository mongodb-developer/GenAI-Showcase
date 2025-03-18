"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactMarkdown from "react-markdown"
import { Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import type { ContentItem } from "@/types/content"

const MdEditor = dynamic(() => import("react-markdown-editor-lite"), {
  ssr: false,
})

import "react-markdown-editor-lite/lib/index.css"

interface GeneratedContent {
  title: string
  content: string
  suggestedTopics: string[]
}

interface CreateContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddContent: (content: Omit<ContentItem, "_id" | "date" | "status">) => void
  editingContent: ContentItem | null
  onEditContent: (content: ContentItem) => Promise<void>
}

const aiFeatures = ["Content Analysis", "SEO Optimization", "Quality Check", "Emotional Impact", "Topic Analysis"]

export function CreateContentDialog({
  open,
  onOpenChange,
  onAddContent,
  editingContent,
  onEditContent,
}: CreateContentDialogProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ContentItem["analysis"]>()
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expertiseLevel, setExpertiseLevel] = useState<string>("mid-level")
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>("")

  useEffect(() => {
    if (editingContent) {
      setTitle(editingContent.title)
      setContent(editingContent.content)
      setSelectedFeatures(editingContent.aiFeatures || [])
      setAnalysis(editingContent.analysis)
    } else {
      resetForm()
    }
  }, [editingContent])

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  const resetForm = () => {
    setTitle("")
    setContent("")
    setSelectedFeatures([])
    setAnalysis(undefined)
    setError(null)
  }

  const analyzeContent = async () => {
    if (!content || !title) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, title, selectedFeatures }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to analyze content")
      }

      const data = await response.json()
      setAnalysis(data)
      return data // Return the analysis data for handleSubmit
    } catch (err) {
      console.error("Error:", err)
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
      throw err // Re-throw to handle in handleSubmit
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSubmit = async () => {
    if (title && content && selectedFeatures.length > 0) {
      try {
        // Always run analysis before submitting if AI features are selected
        if (selectedFeatures.length > 0 && !analysis) {
          await analyzeContent()
        }

        if (editingContent) {
          await onEditContent({
            ...editingContent,
            title,
            content,
            aiFeatures: selectedFeatures,
            analysis: analysis || editingContent.analysis,
            analysisOutdated: !analysis, // Mark as outdated if no new analysis was performed
          })
        } else {
          onAddContent({
            title,
            content,
            aiFeatures: selectedFeatures,
            author: "AI Assistant & User",
            analysis,
            analysisOutdated: false,
          })
        }
        resetForm()
        onOpenChange(false)
      } catch (error) {
        console.error("Error submitting content:", error)
        setError("Failed to save content. Please try again.")
      }
    }
  }

  const handleEditorChange = ({ text }: { text: string }) => {
    setContent(text)
  }

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures((prev) => (prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]))
  }

  const generateContent = async (topic: string) => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          expertiseLevel,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const data: GeneratedContent = await response.json()
      setTitle(data.title)
      setContent(data.content)
      setSuggestedTopics(data.suggestedTopics)
    } catch (err) {
      console.error("Error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingContent ? "Edit Content" : "Create New Content"}</DialogTitle>
          {editingContent?.analysisOutdated && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Content has been modified. Please run analysis again to update AI insights.
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!editingContent && (
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="grid gap-4">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="expertise-level">Expertise Level</Label>
                    <Select value={expertiseLevel} onValueChange={(value) => setExpertiseLevel(value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="mid-level">Mid Level</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Suggested Topics</Label>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTopics.map((topic, index) => (
                        <Button key={index} variant="outline" size="sm" onClick={() => generateContent(topic)}>
                          {topic}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Enter custom topic"
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => generateContent(selectedTopic)} disabled={isGenerating || !selectedTopic}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Content"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="content" className="text-right pt-2">
              Content
            </Label>
            <div className="col-span-3">
              <MdEditor
                style={{ height: "300px" }}
                renderHTML={(text) => <ReactMarkdown>{text}</ReactMarkdown>}
                onChange={handleEditorChange}
                value={content}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">AI Features</Label>
            <div className="col-span-3 space-y-2">
              {aiFeatures.map((feature) => (
                <div key={feature} className="flex items-center space-x-2">
                  <Checkbox
                    id={`feature-${feature}`}
                    checked={selectedFeatures.includes(feature)}
                    onCheckedChange={() => handleFeatureToggle(feature)}
                  />
                  <label htmlFor={`feature-${feature}`} className="text-sm">
                    {feature}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {content && title && (
            <div className="grid grid-cols-4 items-start gap-4">
              <div className="col-start-2 col-span-3">
                <Button
                  onClick={analyzeContent}
                  disabled={isAnalyzing || selectedFeatures.length === 0}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Content...
                    </>
                  ) : (
                    "Analyze Content"
                  )}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <div className="grid grid-cols-4 items-start gap-4">
              <div className="col-start-2 col-span-3">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            </div>
          )}
          {analysis && (
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Analysis Results</Label>
              <div className="col-span-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Analysis</h3>
                  {editingContent?.analysisOutdated && (
                    <span className="text-sm text-yellow-500">(Current analysis may be outdated)</span>
                  )}
                </div>
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="seo">SEO</TabsTrigger>
                    <TabsTrigger value="quality">Quality</TabsTrigger>
                    <TabsTrigger value="emotional">Emotional</TabsTrigger>
                    <TabsTrigger value="topic">Topic</TabsTrigger>
                  </TabsList>
                  <TabsContent value="summary" className="mt-4">
                    <div className="p-4 bg-secondary/20 rounded-md">
                      <ReactMarkdown>{analysis.summary}</ReactMarkdown>
                    </div>
                  </TabsContent>
                  <TabsContent value="seo" className="mt-4">
                    <div className="space-y-4">
                      {analysis.analyses.seo && (
                        <>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">SEO Score</h4>
                            <span className="text-lg font-bold">{analysis.analyses.seo.score}/10</span>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Suggested Title</h4>
                            <p className="text-sm">{analysis.analyses.seo.title}</p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Meta Description</h4>
                            <p className="text-sm">{analysis.analyses.seo.description}</p>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Keywords</h4>
                            <div className="flex flex-wrap gap-2">
                              {analysis.analyses.seo.keywords.map((keyword, index) => (
                                <span key={index} className="px-2 py-1 bg-secondary/30 rounded-md text-xs">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Improvements</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {analysis.analyses.seo.improvements.map((improvement, index) => (
                                <li key={index} className="text-sm">
                                  {improvement}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                      {!analysis.analyses.seo && (
                        <p>SEO analysis not available. Make sure you've selected the SEO Optimization feature.</p>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="quality" className="mt-4">
                    {analysis.analyses.quality ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-secondary/20 rounded-md text-center">
                            <h4 className="font-medium mb-2">Readability</h4>
                            <span className="text-2xl font-bold">{analysis.analyses.quality.readabilityScore}/10</span>
                          </div>
                          <div className="p-4 bg-secondary/20 rounded-md text-center">
                            <h4 className="font-medium mb-2">Clarity</h4>
                            <span className="text-2xl font-bold">{analysis.analyses.quality.clarity}/10</span>
                          </div>
                          <div className="p-4 bg-secondary/20 rounded-md text-center">
                            <h4 className="font-medium mb-2">Structure</h4>
                            <span className="text-2xl font-bold">{analysis.analyses.quality.structure}/10</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Strengths</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysis.analyses.quality.strengths.map((strength, index) => (
                              <li key={index} className="text-sm">
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Suggestions</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysis.analyses.quality.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-sm">
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p>Quality analysis not available. Make sure you've selected the Quality Check feature.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="emotional" className="mt-4">
                    {analysis.analyses.emotional ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-secondary/20 rounded-md">
                          <h4 className="font-medium mb-2">Primary Emotion</h4>
                          <p className="text-lg font-bold">{analysis.analyses.emotional.primaryEmotion}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Emotion Breakdown</h4>
                          <div className="space-y-2">
                            {analysis.analyses.emotional.emotionBreakdown.map((emotion, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="text-sm">{emotion.emotion}</span>
                                <span className="text-sm font-medium">{emotion.percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Tone</h4>
                          <p className="text-sm">{analysis.analyses.emotional.tone}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Engagement Score</h4>
                          <span className="text-2xl font-bold">{analysis.analyses.emotional.engagement}/10</span>
                        </div>
                      </div>
                    ) : (
                      <p>Emotional analysis not available. Make sure you've selected the Emotional Impact feature.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="topic" className="mt-4">
                    {analysis.analyses.topic ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Main Topics</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.analyses.topic.mainTopics.map((topic, index) => (
                              <span key={index} className="px-2 py-1 bg-secondary/30 rounded-md text-sm">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Relevance Score</h4>
                          <span className="text-2xl font-bold">{analysis.analyses.topic.relevanceScore}/10</span>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Suggested Related Topics</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.analyses.topic.suggestedTopics.map((topic, index) => (
                              <span key={index} className="px-2 py-1 bg-secondary/30 rounded-md text-sm">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Audience Match</h4>
                          <p className="text-sm">{analysis.analyses.topic.audienceMatch}</p>
                        </div>
                      </div>
                    ) : (
                      <p>Topic analysis not available. Make sure you've selected the Topic Analysis feature.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            {editingContent ? "Update Content" : "Create Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
