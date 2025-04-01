"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { MoreVertical, Globe, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { ContentItem } from "@/types/content"

interface TranslationMenuProps {
  content: ContentItem
  onTranslationComplete: () => Promise<void>
}

const SUPPORTED_LANGUAGES = {
  fr: "French",
  de: "German",
  es: "Spanish",
  cn: "Chinese",
}

export function TranslationMenu({ content, onTranslationComplete }: TranslationMenuProps) {
  const [isTranslating, setIsTranslating] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")

  const handleTranslate = async (language: string) => {
    setIsTranslating(language)
    try {
      const response = await fetch(`/api/content/${content._id}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetLanguage: language }),
      })

      if (!response.ok) {
        throw new Error("Failed to translate content")
      }

      await onTranslationComplete()
      toast({
        title: "Success",
        description: `Content translated to ${SUPPORTED_LANGUAGES[language]}`,
      })
    } catch (error) {
      console.error("Error translating content:", error)
      toast({
        title: "Error",
        description: "Failed to translate content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsTranslating(null)
      setIsOpen(false)
    }
  }

  const availableLanguages = Object.entries(SUPPORTED_LANGUAGES).filter(([code]) => !content.translations?.[code])

  if (availableLanguages.length === 0) {
    return null
  }

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[40vh]">
          <SheetHeader>
            <SheetTitle>Translate Content</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 py-4">
            {availableLanguages.map(([code, name]) => (
              <Button
                key={code}
                variant="ghost"
                className="justify-start"
                onClick={() => handleTranslate(code)}
                disabled={!!isTranslating}
              >
                <Globe className="mr-2 h-4 w-4" />
                {isTranslating === code ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Translating to {name}...
                  </>
                ) : (
                  `Translate to ${name}`
                )}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuSeparator />
        {availableLanguages.map(([code, name]) => (
          <DropdownMenuItem key={code} onClick={() => handleTranslate(code)} disabled={!!isTranslating}>
            <Globe className="mr-2 h-4 w-4" />
            {isTranslating === code ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Translating...
              </>
            ) : (
              `Translate to ${name}`
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
