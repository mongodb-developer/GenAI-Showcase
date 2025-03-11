"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"

interface LanguageToggleProps {
  currentLanguage: string
  availableLanguages: string[]
  contentId: string
}

const LANGUAGE_NAMES = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  cn: "Chinese",
}

export function LanguageToggle({ currentLanguage, availableLanguages, contentId }: LanguageToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLanguageChange = (language: string) => {
    const params = new URLSearchParams(searchParams)
    if (language === "en") {
      params.delete("lang")
    } else {
      params.set("lang", language)
    }
    router.push(`/content/${contentId}?${params.toString()}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          {LANGUAGE_NAMES[currentLanguage] || currentLanguage}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            className="flex items-center justify-between"
            onClick={() => handleLanguageChange(lang)}
          >
            {LANGUAGE_NAMES[lang]}
            {lang === currentLanguage && (
              <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

