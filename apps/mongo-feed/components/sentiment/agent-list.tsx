"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react"

type Chat = {
  id: string
  date: string
  summary: string
  sentiment: "positive" | "negative" | "neutral"
  issues: string[]
}

type Agent = {
  _id: string
  agentName: string
  sentiment: {
    positive: number
    negative: number
    neutral: number
  }
  totalInteractions: number
  recentChats: Chat[]
}

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [team, setTeam] = useState("all")
  const [search, setSearch] = useState("")
  const [sentiment, setSentiment] = useState("all")
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAgentSentiment = async () => {
      try {
        const response = await fetch("/api/agent-sentiment")
        if (!response.ok) {
          throw new Error("Failed to fetch agent sentiment data")
        }
        const data = await response.json()
        setAgents(data)
      } catch (error) {
        console.error("Error fetching agent sentiment:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgentSentiment()
  }, [])

  const toggleAgent = (agentId: string) => {
    const newExpanded = new Set(expandedAgents)
    if (expandedAgents.has(agentId)) {
      newExpanded.delete(agentId)
    } else {
      newExpanded.add(agentId)
    }
    setExpandedAgents(newExpanded)
  }

  const filteredAgents = agents.filter((agent) => {
    if (!agent || !agent.agentName) return false

    const searchMatch = agent.agentName.toLowerCase().includes(search.toLowerCase())
    const sentimentMatch =
      sentiment === "all" ||
      (sentiment === "positive" && agent.sentiment.positive > agent.sentiment.negative) ||
      (sentiment === "negative" && agent.sentiment.negative > agent.sentiment.positive)

    return searchMatch && sentimentMatch
  })

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Sentiment</CardTitle>
        <CardDescription>Evaluate agents and discover areas that needs customer care improvements.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex gap-4">
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={`All team (${agents.length})`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All team ({agents.length})</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search agent..."
              className="flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <Select value={sentiment} onValueChange={setSentiment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sentiment</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-4 p-4 text-sm font-medium text-muted-foreground border-b">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Total volume</div>
              <div className="col-span-6">Sentiment chart</div>
            </div>
            <div className="divide-y">
              {filteredAgents.map((agent) => {
                const total = agent.totalInteractions
                const positiveWidth = total > 0 ? ((agent.sentiment.positive / total) * 100).toFixed(1) : 0
                const neutralWidth = total > 0 ? ((agent.sentiment.neutral / total) * 100).toFixed(1) : 0
                const negativeWidth = total > 0 ? ((agent.sentiment.negative / total) * 100).toFixed(1) : 0

                return (
                  <Collapsible
                    key={agent._id}
                    open={expandedAgents.has(agent._id)}
                    onOpenChange={() => toggleAgent(agent._id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 cursor-pointer">
                        <div className="col-span-4 flex items-center gap-2">
                          {expandedAgents.has(agent._id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">{agent.agentName}</div>
                          </div>
                        </div>
                        <div className="col-span-2 text-muted-foreground">
                          {agent.totalInteractions.toLocaleString()}
                        </div>
                        <div className="col-span-6">
                          <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex">
                            <div className="h-full bg-destructive" style={{ width: `${negativeWidth}%` }} />
                            <div className="h-full bg-muted-foreground" style={{ width: `${neutralWidth}%` }} />
                            <div className="h-full bg-primary" style={{ width: `${positiveWidth}%` }} />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-12 pb-4 space-y-4">
                        {agent.recentChats?.map((chat) => (
                          <div key={chat.id} className="space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MessageSquare className="h-4 w-4" />
                                {new Date(chat.date).toLocaleString()}
                              </div>
                              <Badge
                                variant={
                                  chat.sentiment === "positive"
                                    ? "default"
                                    : chat.sentiment === "negative"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {chat.sentiment}
                              </Badge>
                            </div>
                            <p className="text-sm">{chat.summary}</p>
                            {chat.issues && chat.issues.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {chat.issues.map((issue, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {issue}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

