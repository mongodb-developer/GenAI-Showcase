import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProcessingQueue } from "@/components/processing-queue"
import { PastAnalysis } from "@/components/past-analysis"
import { AgentAnalysis } from "@/components/agent-analysis"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function ProcessQueuePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Processing Queue</CardTitle>
          <CardDescription>View ongoing and completed analysis tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingSpinner />}>
            <ProcessingQueue />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Analysis</CardTitle>
          <CardDescription>Review previously completed analysis tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <PastAnalysis />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Analysis</CardTitle>
          <CardDescription>View aggregated sentiment analysis for agents</CardDescription>
        </CardHeader>
        <CardContent>
          <AgentAnalysis />
        </CardContent>
      </Card>
    </div>
  )
}

