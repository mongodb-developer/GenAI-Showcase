import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, MessageSquare, BarChart2, LineChart, PieChart, ArrowRight, ListChecks } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">Welcome to MongoFeed</h1>
        <p className="text-muted-foreground">
          Your comprehensive platform for product feedback analysis and sentiment tracking
        </p>
      </div>

      <Tabs defaultValue="input" className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="input">Input Sources</TabsTrigger>
          <TabsTrigger value="analysis">Analysis Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="input" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  File Upload
                </CardTitle>
                <CardDescription>Upload product feedback data files for analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Supported formats:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>JSON data</li>
                  <li>HTML scrapes</li>
                  <li>Screenshots</li>
                </ul>
                <Button asChild className="w-full mt-4">
                  <Link href="/upload" className="flex items-center justify-center gap-2">
                    Start Uploading
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat Paste
                </CardTitle>
                <CardDescription>Paste product review logs directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Supported content:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  <li>Customer reviews</li>
                  <li>Product feedback</li>
                  <li>Social media comments</li>
                  <li>Survey responses</li>
                </ul>
                <Button asChild variant="outline" className="w-full mt-4">
                  <Link href="/paste" className="flex items-center justify-center gap-2">
                    Start Pasting
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5" />
                  Feedback Analysis
                </CardTitle>
                <CardDescription>Analyze feedback patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  View comprehensive feedback analysis including sentiment trends, common issues, and customer
                  satisfaction metrics.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/feedback" className="flex items-center justify-center gap-2">
                    View Analysis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Sentiment Trends
                </CardTitle>
                <CardDescription>Track product sentiment</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Monitor product sentiment trends over time, identifying areas for improvement and success stories.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/sentiment" className="flex items-center justify-center gap-2">
                    View Trends
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Charts & Reports
                </CardTitle>
                <CardDescription>Visualize your data</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access detailed charts and reports to gain insights into product feedback trends and patterns over
                  time.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/charts" className="flex items-center justify-center gap-2">
                    View Charts
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  Process Queue
                </CardTitle>
                <CardDescription>Monitor analysis progress</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  View ongoing analysis tasks, track progress, and access past analysis results.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/process-queue" className="flex items-center justify-center gap-2">
                    View Queue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to begin analyzing your product feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 list-decimal list-inside text-sm">
            <li className="text-muted-foreground">
              <span className="font-medium text-foreground">Choose your input method:</span> Upload files containing
              product feedback data or paste review logs directly into the system.
            </li>
            <li className="text-muted-foreground">
              <span className="font-medium text-foreground">Process your data:</span> The system will automatically
              analyze your input for sentiment and key patterns.
            </li>
            <li className="text-muted-foreground">
              <span className="font-medium text-foreground">Explore insights:</span> Use the analysis tools to view
              feedback trends, product performance, and detailed reports.
            </li>
            <li className="text-muted-foreground">
              <span className="font-medium text-foreground">Take action:</span> Use the insights to improve product
              features, marketing strategies, and overall customer satisfaction.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
