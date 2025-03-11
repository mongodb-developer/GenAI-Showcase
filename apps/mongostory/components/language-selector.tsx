"use client"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"

interface LanguageSelectorProps {
  currentLanguage: string
  availableLanguages: string[]
  onLanguageChange: (language: string) => void
}

const LANGUAGE_NAMES = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  cn: "Chinese",
}

export function LanguageSelector({ currentLanguage, availableLanguages, onLanguageChange }: LanguageSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          {LANGUAGE_NAMES[currentLanguage] || currentLanguage}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        {availableLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className="flex items-center justify-between"
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

