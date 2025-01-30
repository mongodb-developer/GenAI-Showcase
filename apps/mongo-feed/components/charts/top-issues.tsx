"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/ui/error-message"

interface TopIssue {
  name: string
  count: number
  type: "agent" | "product"
  sentiment: "positive" | "negative" | "neutral"
}

export function TopIssuesChart() {
  const [data, setData] = useState<TopIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<"all" | "agent" | "product">("all")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/feedback/top-issues")
        if (!response.ok) throw new Error("Failed to fetch top issues")
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error("Error:", error)
        setError("Failed to load top issues data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

  const filteredData = selectedType === "all" ? data : data.filter((item) => item.type === selectedType)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Top Issues</h3>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Most frequently mentioned issues across feedback types.</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>

        <Select value={selectedType} onValueChange={(value: "all" | "agent" | "product") => setSelectedType(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Issues</SelectItem>
            <SelectItem value="agent">Agent Issues</SelectItem>
            <SelectItem value="product">Product Issues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill={`hsl(var(--primary))`} name="Occurrence Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

