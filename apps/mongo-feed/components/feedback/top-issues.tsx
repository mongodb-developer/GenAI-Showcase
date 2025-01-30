"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { Card } from "@/components/ui/card"

interface TopIssue {
  name: string
  count: number
  type: "agent" | "product"
  sentiment: "positive" | "negative" | "neutral"
}

export function TopIssues() {
  const [issues, setIssues] = useState<TopIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/feedback/top-issues?sentiment=negative")
        if (!response.ok) {
          throw new Error("Failed to fetch top issues")
        }
        const data = await response.json()
        setIssues(data)
      } catch (err) {
        setError("Failed to load top issues")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!issues.length) return <div className="text-center text-muted-foreground">No issues found</div>

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {issues.map((issue, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium truncate flex-1">{issue.name}</h3>
            <span className="text-sm font-medium ml-2">{issue.count}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{issue.type}</Badge>
            <Badge variant="destructive">negative</Badge>
          </div>
        </Card>
      ))}
    </div>
  )
}

