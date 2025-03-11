"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Globe, ChevronDown, GitCompare, MessageSquare, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { TranslationMenu } from "./translation-menu"
import { LanguageSelector } from "./language-selector"
import { SocialMediaDialog } from "./social-media-dialog"
import { useState } from "react"
import type { ContentItem } from "@/types/content"
import { toast } from "@/components/ui/use-toast"

interface ContentListItemProps {
  content: ContentItem
  isRevision?: boolean
  onEdit: (content: ContentItem) => void
  onRefresh: () => Promise<void>
  selectedLanguage?: string
  onLanguageChange?: (language: string) => void
  showHeader?: boolean
  onCompare?: () => void
  onPublish?: (id: string) => Promise<void>
  onToggleExpand?: () => void
  isExpanded?: boolean
}

export function ContentListItem({
  content,
  isRevision,
  onEdit,
  onRefresh,
  selectedLanguage,
  onLanguageChange,
  showHeader = true,
  onCompare,
  onPublish,
  onToggleExpand,
  isExpanded,
}: ContentListItemProps) {
  const [isSocialMediaDialogOpen, setIsSocialMediaDialogOpen] = useState(false)

  // Get the current translation based on selected language
  const translation = selectedLanguage && selectedLanguage !== "en" ? content.translations?.[selectedLanguage] : null

  const availableLanguages = ["en", ...(content.translations ? Object.keys(content.translations) : [])]

  const currentTitle = translation?.title || content.title
  const currentContent = translation?.content || content.content

  const truncatedContent =
    currentContent.replace(/[#*`]/g, "").slice(0, 200).trim() + (currentContent.length > 200 ? "..." : "")

  const handlePublish = async () => {
    if (!onPublish) return
    try {
      await onPublish(content._id)
      toast({
        title: "Success",
        description: content.status === "published" ? "Content unpublished" : "Content published successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update content status",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card
        className={`relative border border-border/50 shadow-sm rounded-lg 
        ${isRevision ? "border-l-2 border-l-primary" : ""}`}
      >
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold tracking-tight">{currentTitle}</h3>
                  {isRevision && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        Revised by AI
                      </Badge>
                      {onCompare && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-primary border-primary/20 hover:bg-primary/10"
                          onClick={onCompare}
                        >
                          <GitCompare className="h-3 w-3" />
                          <span className="hidden sm:inline">Compare versions</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{truncatedContent}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(content.date).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{content.status === "published" ? "Published" : "Draft"}</span>
                  {content.translations && (
                    <>
                      <span>•</span>
                      <span>{Object.keys(content.translations).length + 1} languages</span>
                    </>
                  )}
                  {translation && (
                    <>
                      <span>•</span>
                      <span>Translated {translation.translatedBy === "AI" ? "by AI" : "manually"}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                {onPublish && (
                  <Button
                    variant={content.status === "published" ? "destructive" : "default"}
                    size="sm"
                    className="w-full sm:w-auto gap-2"
                    onClick={handlePublish}
                  >
                    {content.status === "published" ? (
                      <>
                        <XCircle className="h-4 w-4" />
                        <span>Unpublish</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Publish</span>
                      </>
                    )}
                  </Button>
                )}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(content)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsSocialMediaDialogOpen(true)}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  {content.status === "published" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/content/${content._id}`} target="_blank">
                        <Globe className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  {content.translations && onLanguageChange && (
                    <LanguageSelector
                      currentLanguage={selectedLanguage || "en"}
                      availableLanguages={availableLanguages}
                      onLanguageChange={onLanguageChange}
                    />
                  )}
                  <TranslationMenu content={content} onTranslationComplete={onRefresh} />
                  {onToggleExpand && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleExpand}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      <span className="sr-only">Toggle preview</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <SocialMediaDialog
        open={isSocialMediaDialogOpen}
        onOpenChange={setIsSocialMediaDialogOpen}
        contentId={content._id}
        content={{
          title: translation?.title || content.title,
          content: translation?.content || content.content,
          status: content.status,
        }}
      />
    </>
  )
}

