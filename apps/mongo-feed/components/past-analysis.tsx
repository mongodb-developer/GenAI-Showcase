"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon, Download } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

type AnalysisItem = {
  id: string
  name: string
  date: string
  duration: string
  status: "completed" | "failed"
}

export function PastAnalysis() {
  const [pastAnalysis, setPastAnalysis] = useState<AnalysisItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPastAnalysis = async () => {
      try {
        const response = await fetch("/api/past-analysis")
        if (!response.ok) {
          throw new Error("Failed to fetch past analysis")
        }
        const data = await response.json()
        setPastAnalysis(data)
      } catch (error) {
        console.error("Error fetching past analysis:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPastAnalysis()
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Past Analysis</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Past analysis results are stored in MongoDB and can be quickly retrieved using Atlas vector search.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Potential query: "Find similar analyses to the most recent customer feedback report"
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pastAnalysis.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.duration}</TableCell>
              <TableCell>
                <span className={item.status === "completed" ? "text-green-600" : "text-red-600"}>{item.status}</span>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" disabled={item.status === "failed"}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

