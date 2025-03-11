"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getDashboardData } from "@/lib/actions/dashboard-actions"

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Redirect to login if not authenticated
  if (!authLoading && !user) {
    redirect("/login")
  }

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true)
        const data = await getDashboardData()
        setDashboardData(data)
      } catch (err) {
        console.error("Error fetching dashboard data:", err)
        setError("Failed to load dashboard data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (isLoading) {
    return (
      <div className="container py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { recentContent = [], analytics = {}, aiInsights = {} } = dashboardData || {}

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Dashboard</h1>

      <div className="grid gap-6">
        {/* Recent Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Content</CardTitle>
            <CardDescription>Your recently created content</CardDescription>
          </CardHeader>
          <CardContent>
            {recentContent.length > 0 ? (
              <div className="space-y-4">
                {recentContent.map((item) => (
                  <div key={item._id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{new Date(item.date).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={item.status === "published" ? "default" : "secondary"}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No content yet"
                description="Create your first content to get started."
                action={
                  <Button asChild>
                    <Link href="/dashboard/content">Create Content</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Analytics Card */}
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Content performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Total Views</h3>
                <p className="text-2xl font-bold">{analytics.totalViews || 0}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Avg. Time</h3>
                <p className="text-2xl font-bold">{analytics.avgTimeOnPage || 0}s</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Engagement Rate</span>
                  <span className="text-sm font-medium">{analytics.engagementRate || 0}%</span>
                </div>
                <Progress value={analytics.engagementRate || 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Card */}
        <Card>
          <CardHeader>
            <CardTitle>AI Insights</CardTitle>
            <CardDescription>Content intelligence overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Content Quality</h3>
                <div className="flex items-center gap-2">
                  <Progress value={(aiInsights.contentQuality || 0) * 10} className="flex-1" />
                  <span className="text-sm font-medium">{aiInsights.contentQuality || 0}/10</span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Top Topics</h3>
                {aiInsights.topTopics && aiInsights.topTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {aiInsights.topTopics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="bg-primary/10">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No topics available yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

