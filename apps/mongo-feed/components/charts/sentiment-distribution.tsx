"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/ui/error-message"

interface SentimentData {
  name: string
  value: number
  type: "agent" | "product"
}

const COLORS = {
  positive: "hsl(var(--primary))",
  negative: "hsl(var(--destructive))",
  neutral: "hsl(var(--muted-foreground))",
  unknown: "hsl(var(--muted))",
}

const SENTIMENT_LABELS = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  unknown: "Unknown",
}

export function SentimentDistributionChart() {
  const [data, setData] = useState<SentimentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<"all" | "agent" | "product">("all")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/feedback/sentiment-distribution")
        if (!response.ok) {
          throw new Error("Failed to fetch sentiment distribution")
        }
        const result = await response.json()
        // Ensure the data is in the correct format
        const formattedData = result.map((item: any) => ({
          name: item.name ? item.name.toLowerCase() : "unknown",
          value: item.value || 0,
          type: item.type || "unknown",
        }))
        setData(formattedData)
      } catch (error) {
        console.error("Error:", error)
        setError("Failed to load sentiment distribution data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

  const filteredData = selectedType === "all" ? data : data.filter((item) => item.type === selectedType)

  // Aggregate data by sentiment
  const aggregatedData = filteredData.reduce(
    (acc, item) => {
      if (!acc[item.name]) {
        acc[item.name] = 0
      }
      acc[item.name] += item.value
      return acc
    },
    {} as Record<string, number>,
  )

  // Convert aggregated data back to array format
  const chartData = Object.entries(aggregatedData).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Sentiment Distribution</h3>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Distribution of sentiment across all feedback types.</p>
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

      {chartData.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.neutral} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                formatter={(value: string) => SENTIMENT_LABELS[value as keyof typeof SENTIMENT_LABELS] || value}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-8">No data available for the selected type.</div>
      )}
    </div>
  )
}

