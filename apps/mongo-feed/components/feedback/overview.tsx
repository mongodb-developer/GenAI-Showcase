"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { FeedbackChart } from "./feedback-chart"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"

interface FeedbackStats {
  totalFeedback: number
  sentimentScore: number
  trendData: Array<{
    date: string
    positive: number
    negative: number
    neutral: number
  }>
}

export function FeedbackOverview() {
  const [stats, setStats] = useState<FeedbackStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/feedback/overview")
        if (!response.ok) {
          throw new Error("Failed to fetch feedback overview")
        }
        const data = await response.json()
        setStats(data)
      } catch (err) {
        setError("Failed to load feedback overview")
        console.error("Error fetching feedback overview:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!stats) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Feedback Overview
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Overview of all feedback data aggregated from MongoDB</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Feedback</div>
              <div className="text-2xl font-bold">{stats.totalFeedback}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Sentiment</div>
              <div className="text-2xl font-bold text-emerald-500">{stats.sentimentScore}%</div>
            </div>
          </div>
          <div className="h-[200px]">
            <FeedbackChart data={stats.trendData} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
