"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/ui/error-message"

interface TrendData {
  date: string
  type: "agent" | "product"
  positive: number
  negative: number
  neutral: number
}

export function FeedbackTrendChart() {
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<"all" | "agent" | "product">("all")

  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        const response = await fetch("/api/feedback/trend")
        if (!response.ok) {
          throw new Error("Failed to fetch trend data")
        }
        const data = await response.json()
        setTrendData(data)
      } catch (error) {
        console.error("Error fetching trend data:", error)
        setError("Failed to load trend data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrendData()
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  const filteredData = selectedType === "all" ? trendData : trendData.filter((item) => item.type === selectedType)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Feedback Trend</h3>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>This chart shows the trend of feedback sentiment over time for both agent and product feedback.</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>

        <Select value={selectedType} onValueChange={(value: "all" | "agent" | "product") => setSelectedType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Feedback</SelectItem>
            <SelectItem value="agent">Agent Feedback</SelectItem>
            <SelectItem value="product">Product Reviews</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="positive" stroke="hsl(var(--primary))" name="Positive" />
            <Line type="monotone" dataKey="negative" stroke="hsl(var(--destructive))" name="Negative" />
            <Line type="monotone" dataKey="neutral" stroke="hsl(var(--muted-foreground))" name="Neutral" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
