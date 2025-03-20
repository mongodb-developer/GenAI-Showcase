"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { AnalysisComparisonDialog } from "@/components/analysis-comparison-dialog"
import type { ContentItem } from "@/types/content"
import { CreateContentDialog } from "@/components/create-content-dialog"
import { ContentListItem } from "@/components/content-list-item"
import { ContentPreviewTabs } from "@/components/content-preview-tabs"
import { ContentSkeleton } from "@/components/skeletons"
import { TabbedContent } from "@/components/tabbed-content"
import { FileText, Clock, Star } from "lucide-react"

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null)
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false)
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [parentContent, setParentContent] = useState<ContentItem | null>(null)
  const [isRevising, setIsRevising] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchContent()
  }, [])

  const fetchContent = async () => {
    try {
      const response = await fetch("/api/content")
      if (!response.ok) {
        throw new Error("Failed to fetch content")
      }
      const data = await response.json()
      setContent(data)
    } catch (error) {
      console.error("Error fetching content:", error)
      toast({
        title: "Error",
        description: "Failed to fetch content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddContent = async (newContent: Omit<ContentItem, "_id" | "date" | "status">) => {
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newContent),
      })

      if (!response.ok) {
        throw new Error("Failed to create content")
      }

      const createdContent = await response.json()
      setContent((prev) => [createdContent, ...prev])
      toast({
        title: "Success",
        description: "Content created successfully.",
      })
    } catch (error) {
      console.error("Error creating content:", error)
      toast({
        title: "Error",
        description: "Failed to create content. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditContent = async (updatedContent: ContentItem) => {
    try {
      const response = await fetch(`/api/content/${updatedContent._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedContent),
      })

      if (!response.ok) {
        throw new Error("Failed to update content")
      }

      const updated = await response.json()
      setContent((prev) => prev.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)))
      toast({
        title: "Success",
        description: "Content updated successfully.",
      })
    } catch (error) {
      console.error("Error updating content:", error)
      toast({
        title: "Error",
        description: "Failed to update content. Please try again.",
        variant: "destructive",
      })
    }
  }

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

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/content/${id}/publish`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to update content status")
      }

      const { status } = await response.json()
      setContent((prev) => prev.map((item) => (item._id === id ? { ...item, status } : item)))
    } catch (error) {
      console.error("Error updating content status:", error)
      throw error
    }
  }

  const handleCompareVersions = async (content: ContentItem) => {
    if (!content.parentId) return

    try {
      const response = await fetch(`/api/content/${content.parentId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch parent content")
      }
      const parentContent = await response.json()
      setParentContent(parentContent)
      setSelectedContent(content)
      setIsComparisonDialogOpen(true)
    } catch (error) {
      console.error("Error fetching parent content:", error)
      toast({
        title: "Error",
        description: "Failed to fetch content for comparison.",
        variant: "destructive",
      })
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <ContentSkeleton />
      </div>
    )
  }

  const renderContentItem = (item: ContentItem) => {
    const revisions = content.filter((c) => c.parentId === item._id)
    const isExpanded = expandedItems.has(item._id)

    return (
      <div key={item._id} className="space-y-4">
        <ContentListItem
          content={item}
          onEdit={(content) => {
            setEditingContent(content)
            setIsCreateDialogOpen(true)
          }}
          onRefresh={fetchContent}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          onPublish={handlePublish}
          onToggleExpand={() => toggleExpanded(item._id)}
          isExpanded={isExpanded}
        />

        {isExpanded && (
          <div className="pl-6">
            <ContentPreviewTabs
              content={item}
              initialLanguage={selectedLanguage}
              onReviseWithAI={handleReviseWithAI}
              isRevising={isRevising === item._id}
            />
            {revisions.map((revision) => (
              <div key={revision._id} className="mt-4 border-l-2 border-primary/50 pl-4">
                <ContentListItem
                  content={revision}
                  isRevision
                  onEdit={(content) => {
                    setEditingContent(content)
                    setIsCreateDialogOpen(true)
                  }}
                  onRefresh={fetchContent}
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  onCompare={() => handleCompareVersions(revision)}
                  onPublish={handlePublish}
                  onToggleExpand={() => toggleExpanded(revision._id)}
                  isExpanded={expandedItems.has(revision._id)}
                />
                {expandedItems.has(revision._id) && (
                  <div className="mt-4">
                    <ContentPreviewTabs
                      content={revision}
                      initialLanguage={selectedLanguage}
                      onReviseWithAI={handleReviseWithAI}
                      isRevising={isRevising === revision._id}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const mainContent = content.filter((item) => !item.parentId)

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content</h1>
          <p className="text-muted-foreground">Create and manage your content with AI assistance.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Content
        </Button>
      </div>

      <TabbedContent
        tabs={[
          {
            id: "all",
            label: "All Content",
            icon: <FileText className="h-4 w-4" />,
            content: <div className="space-y-6">{mainContent.map(renderContentItem)}</div>,
          },
          {
            id: "published",
            label: "Published",
            icon: <Star className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {mainContent.filter((item) => item.status === "published").map(renderContentItem)}
              </div>
            ),
          },
          {
            id: "drafts",
            label: "Drafts",
            icon: <Clock className="h-4 w-4" />,
            content: (
              <div className="space-y-6">
                {mainContent.filter((item) => item.status === "draft").map(renderContentItem)}
              </div>
            ),
          },
        ]}
        defaultTab="all"
      />

      <CreateContentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onAddContent={handleAddContent}
        editingContent={editingContent}
        onEditContent={handleEditContent}
      />

      <AnalysisComparisonDialog
        open={isComparisonDialogOpen}
        onOpenChange={setIsComparisonDialogOpen}
        originalAnalysis={parentContent?.analysis || null}
        revisedAnalysis={selectedContent?.analysis || null}
      />
    </div>
  )
}
