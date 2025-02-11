import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FeedbackTrendChart } from "@/components/charts/feedback-trend"
import { SentimentDistributionChart } from "@/components/charts/sentiment-distribution"
import { TopIssuesChart } from "@/components/charts/top-issues"

export default function ChartsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feedback Trend</CardTitle>
          <CardDescription>View feedback volume and sentiment over time</CardDescription>
        </CardHeader>
        <CardContent>
          <FeedbackTrendChart />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
            <CardDescription>Overall sentiment breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <SentimentDistributionChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Issues</CardTitle>
            <CardDescription>Most frequently mentioned issues</CardDescription>
          </CardHeader>
          <CardContent>
            <TopIssuesChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
