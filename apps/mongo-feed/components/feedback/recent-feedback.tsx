"use client"

import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { Badge } from "@/components/ui/badge"

interface FeedbackItem {
  id: string
  score: number
  title: string
  type: "agent" | "product"
  timeAgo: string
}

export function RecentFeedback() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/feedback/recent")
        if (!response.ok) {
          throw new Error("Failed to fetch recent feedback")
        }
        const data = await response.json()
        setFeedback(data)
      } catch (err) {
        setError("Failed to load recent feedback")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

  return (
    <div className="space-y-4">
      {feedback.map((item) => (
        <div key={item.id} className="flex items-start gap-4">
          <div
            className={`flex-none w-8 h-8 rounded-full bg-muted flex items-center justify-center ${
              item.score >= 4
                ? "bg-emerald-100 text-emerald-700"
                : item.score <= 2
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            <span className="text-sm font-medium">{item.score}</span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{item.title}</p>
              <Badge variant={item.type === "agent" ? "default" : "secondary"}>{item.type}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{item.timeAgo}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

