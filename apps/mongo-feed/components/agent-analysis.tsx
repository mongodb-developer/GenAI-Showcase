"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

type AgentSentiment = {
  agentName: string
  positiveSentiment: number
  neutralSentiment: number
  negativeSentiment: number
  totalInteractions: number
}

export function AgentAnalysis() {
  const [agentSentiments, setAgentSentiments] = useState<AgentSentiment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAgentAnalysis = async () => {
      try {
        const response = await fetch("/api/agent-analysis")
        if (!response.ok) {
          throw new Error("Failed to fetch agent analysis")
        }
        const data = await response.json()
        setAgentSentiments(data)
      } catch (error) {
        console.error("Error fetching agent analysis:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgentAnalysis()
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Agent Sentiment Analysis
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Agent sentiment analysis is aggregated from LLM processing of customer interactions.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Potential query: "Which agent has the highest positive sentiment ratio?"
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead>Positive</TableHead>
              <TableHead>Neutral</TableHead>
              <TableHead>Negative</TableHead>
              <TableHead>Total Interactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agentSentiments.map((agent) => (
              <TableRow key={agent.agentName}>
                <TableCell>{agent.agentName}</TableCell>
                <TableCell>{agent.positiveSentiment}</TableCell>
                <TableCell>{agent.neutralSentiment}</TableCell>
                <TableCell>{agent.negativeSentiment}</TableCell>
                <TableCell>{agent.totalInteractions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

