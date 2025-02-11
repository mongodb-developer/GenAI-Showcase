import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FeedbackOverview } from "@/components/feedback/overview"
import { RecentFeedback } from "@/components/feedback/recent-feedback"
import { TopIssues } from "@/components/feedback/top-issues"

export default async function FeedbackPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FeedbackOverview />
        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentFeedback />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Top Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <TopIssues />
        </CardContent>
      </Card>
    </div>
  )
}
