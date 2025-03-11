"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Twitter, Facebook, Linkedin, Instagram } from "lucide-react"

interface SocialMediaOptionsBannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreatePost: () => void
}

export function SocialMediaOptionsBanner({ open, onOpenChange, onCreatePost }: SocialMediaOptionsBannerProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300) // Match this with the CSS transition time
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!isVisible) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 transition-transform duration-300 ease-in-out ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex space-x-4">
          <Button variant="outline" size="icon" onClick={() => onCreatePost()}>
            <Twitter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onCreatePost()}>
            <Facebook className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onCreatePost()}>
            <Linkedin className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onCreatePost()}>
            <Instagram className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="default" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </div>
    </div>
  )
}

