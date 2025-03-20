"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Markdown } from "@/components/ui/markdown"
import { LanguageSelector } from "./language-selector"
import type { ContentItem } from "@/types/content"

interface ContentPreviewProps {
  content: ContentItem
  initialLanguage?: string
}

export function ContentPreview({ content, initialLanguage = "en" }: ContentPreviewProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage)
  const translation = selectedLanguage !== "en" ? content.translations?.[selectedLanguage] : null

  const availableLanguages = ["en", ...(content.translations ? Object.keys(content.translations) : [])]

  // Update selected language when initialLanguage changes
  useEffect(() => {
    setSelectedLanguage(initialLanguage)
  }, [initialLanguage])

  const currentTitle = translation?.title || content.title
  const currentContent = translation?.content || content.content

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{currentTitle}</h2>
        <div className="flex items-center justify-end w-full sm:w-auto">
          <LanguageSelector
            currentLanguage={selectedLanguage}
            availableLanguages={availableLanguages}
            onLanguageChange={setSelectedLanguage}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose dark:prose-invert max-w-none">
          <Markdown>{currentContent}</Markdown>
        </div>
      </CardContent>
    </Card>
  )
}
