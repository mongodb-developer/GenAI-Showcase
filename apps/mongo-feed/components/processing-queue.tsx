"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type QueueItem = {
  id: string
  name: string
  progress: number
  status: "processing" | "queued" | "completed" | "error"
  type: "agent" | "product"
}

type LogEntry = {
  timestamp: string
  message: string
}

function ProcessingQueueContent() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const submittedId = searchParams.get("id")

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await fetch("/api/process-queue")
        if (!response.ok) {
          throw new Error("Failed to fetch queue")
        }
        const data = await response.json()
        setQueue(data)
      } catch (error) {
        console.error("Error fetching queue:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (submittedId || selectedChatId) {
      const chatId = submittedId || selectedChatId
      const fetchLogs = async () => {
        try {
          const response = await fetch(`/api/processing-logs/${chatId}`)
          if (!response.ok) {
            throw new Error("Failed to fetch processing logs")
          }
          const data = await response.json()
          setLogs(data.logs)
        } catch (error) {
          console.error("Error fetching processing logs:", error)
        }
      }

      fetchLogs()
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [submittedId, selectedChatId])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Queue
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Analysis tasks for both agent feedback and product reviews are processed here.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 ${submittedId === item.id ? "bg-yellow-100 p-2 rounded" : ""}`}
              >
                <div className="w-48 truncate flex items-center gap-2">
                  {item.name}
                  <Badge variant={item.type === "agent" ? "default" : "secondary"}>{item.type}</Badge>
                </div>
                <Progress value={item.progress} className="flex-1" />
                <div className="w-24 text-right">
                  {item.status === "processing" ? `${item.progress}%` : item.status}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedChatId(item.id)}>
                  View Logs
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {(selectedChatId || submittedId) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Processing Logs for {selectedChatId || submittedId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">{new Date(log.timestamp).toLocaleString()}: </span>
                  {log.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function ProcessingQueue() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProcessingQueueContent />
    </Suspense>
  )
}

