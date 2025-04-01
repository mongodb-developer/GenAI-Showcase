"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Search, Layers, Network, Lightbulb, RefreshCw, PieChart } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { ContentItem } from "@/types/content"
import { toast } from "@/components/ui/use-toast"

interface ContentCluster {
  id: number
  label: string
  keywords: string[]
  contentIds: string[]
  items?: ContentItem[]
}

export function SemanticContentExplorer() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<ContentItem[]>([])
  const [allContent, setAllContent] = useState<ContentItem[]>([])
  const [clusters, setClusters] = useState<ContentCluster[]>([])
  const [isLoadingClusters, setIsLoadingClusters] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<ContentCluster | null>(null)
  const [clusterContent, setClusterContent] = useState<ContentItem[]>([])
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([])
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [isLoadingRelated, setIsLoadingRelated] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Function to deduplicate clusters by label
  const deduplicateClusters = (rawClusters) => {
    const uniqueClusters = new Map()

    rawClusters.forEach((cluster) => {
      if (uniqueClusters.has(cluster.label)) {
        const existing = uniqueClusters.get(cluster.label)
        // Merge contentIds without duplicates
        const mergedContentIds = [...new Set([...existing.contentIds, ...cluster.contentIds])]
        uniqueClusters.set(cluster.label, {
          ...cluster,
          contentIds: mergedContentIds,
        })
      } else {
        uniqueClusters.set(cluster.label, cluster)
      }
    })

    return Array.from(uniqueClusters.values())
  }

  // Fetch all content on initial load
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch("/api/content")
        if (!response.ok) throw new Error(`Failed to fetch content: ${response.status}`)
        const data = await response.json()
        setAllContent(data.filter((item: ContentItem) => item.embedding))
      } catch (error) {
        console.error("Error fetching content:", error)
        toast({
          title: "Error",
          description: "Failed to fetch content. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchContent()
  }, [])

  // Fetch clusters on initial load
  useEffect(() => {
    fetchClusters()
  }, [])

  const fetchClusters = async () => {
    setIsLoadingClusters(true)
    try {
      // Updated endpoint from /api/content/clusters to /api/clusters
      const response = await fetch("/api/clusters")
      if (!response.ok) throw new Error(`Failed to fetch clusters: ${response.status}`)
      const data = await response.json()

      // Deduplicate clusters before setting state
      const uniqueClusters = deduplicateClusters(data.clusters || [])
      setClusters(uniqueClusters)
    } catch (error) {
      console.error("Error fetching clusters:", error)
      toast({
        title: "Error",
        description: "Failed to fetch content clusters. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingClusters(false)
    }
  }

  // Update the handleSearch function to better reflect MongoDB Atlas vector search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch("/api/content/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
        }),
      })

      if (!response.ok) throw new Error(`Search failed: ${response.status}`)

      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search Error",
        description: "Failed to perform semantic search. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleClusterSelect = (cluster: ContentCluster) => {
    setSelectedCluster(cluster)

    // If the cluster already has items, use them
    if (cluster.items && cluster.items.length > 0) {
      setClusterContent(cluster.items)
      return
    }

    // Otherwise, find content items that belong to this cluster
    const contentInCluster = allContent.filter((item) => cluster.contentIds.includes(item._id.toString()))

    setClusterContent(contentInCluster)
  }

  // Update the handleFindRelated function to use the semantic-search endpoint
  const handleFindRelated = async (content: ContentItem) => {
    setSelectedContent(content)
    setIsLoadingRelated(true)

    try {
      const response = await fetch("/api/content/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: content._id,
          limit: 5,
        }),
      })

      if (!response.ok) throw new Error(`Failed to find related content: ${response.status}`)

      const data = await response.json()
      setRelatedContent(data)
    } catch (error) {
      console.error("Error finding related content:", error)
      toast({
        title: "Error",
        description: "Failed to find related content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingRelated(false)
    }
  }

  const handleRefreshClusters = async () => {
    setIsRegenerating(true)
    try {
      // Updated endpoint from /api/content/regenerate-clusters to /api/clusters/regenerate
      const response = await fetch("/api/clusters/regenerate", {
        method: "POST",
      })

      if (!response.ok) throw new Error(`Failed to regenerate clusters: ${response.status}`)

      toast({
        title: "Success",
        description: "Content clusters have been regenerated.",
      })

      // Fetch the updated clusters
      fetchClusters()
    } catch (error) {
      console.error("Error regenerating clusters:", error)
      toast({
        title: "Error",
        description: "Failed to regenerate content clusters. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  // Calculate topic distribution
  const topicDistribution = useMemo(() => {
    if (!clusters.length || !allContent.length) return []

    return clusters
      .map((cluster) => ({
        name: cluster.label,
        value: cluster.contentIds.length,
        percentage: Math.round((cluster.contentIds.length / allContent.length) * 100) || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // Limit to top 5 topics
  }, [clusters, allContent])

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Intelligence</h1>
          <p className="text-muted-foreground">
            Discover insights and connections in your content using AI-powered semantic analysis
          </p>
        </div>
        <Button onClick={handleRefreshClusters} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Clusters
        </Button>
      </div>

      <Tabs defaultValue="discover" className="space-y-8">
        <TabsList>
          <TabsTrigger value="discover" className="gap-2">
            <Search className="h-4 w-4" />
            Semantic Search
          </TabsTrigger>
          <TabsTrigger value="clusters" className="gap-2">
            <Layers className="h-4 w-4" />
            Content Clusters
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-2">
            <Network className="h-4 w-4" />
            Related Content
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Content Insights
          </TabsTrigger>
        </TabsList>

        {/* Semantic Search Tab */}
        <TabsContent value="discover" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Semantic Search</CardTitle>
              <CardDescription>Find content based on meaning, not just keywords</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-6">
                <Input
                  placeholder="Search by concepts, topics, or ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <>Searching...</>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Results</h3>
                  <div className="space-y-4">
                    {searchResults.map((content) => (
                      <div key={content._id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-1">{content.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {content.content.substring(0, 150)}...
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-muted-foreground">
                            {new Date(content.date).toLocaleDateString()}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleFindRelated(content)}>
                            Find Related
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No results found for your query.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Clusters Tab */}
        <TabsContent value="clusters" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Topic Clusters</CardTitle>
                <CardDescription>AI-generated content categories based on semantic similarity</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingClusters ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Only show unique clusters */}
                    {clusters.slice(0, 6).map((cluster) => (
                      <Button
                        key={cluster.id}
                        variant={selectedCluster?.id === cluster.id ? "default" : "outline"}
                        className="w-full justify-start h-auto py-2 px-3"
                        onClick={() => handleClusterSelect(cluster)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{cluster.label}</span>
                          <span className="text-xs text-muted-foreground">{cluster.contentIds.length} articles</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{selectedCluster ? selectedCluster.label : "Select a Cluster"}</CardTitle>
                {selectedCluster && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedCluster.keywords.map((keyword, i) => (
                      <Badge key={i} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!selectedCluster ? (
                  <div className="text-center py-12">
                    <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Select a cluster to view related content</p>
                  </div>
                ) : clusterContent.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No content in this cluster</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clusterContent.map((content) => (
                      <div key={content._id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-1">{content.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {content.content.substring(0, 150)}...
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-muted-foreground">
                            {new Date(content.date).toLocaleDateString()}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleFindRelated(content)}>
                            Find Related
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {topicDistribution.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-muted/30 rounded-md p-12">
              <Network className="h-16 w-16 text-primary/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Content Clusters Available</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Generate clusters to visualize how your content is organized semantically by related topics and themes.
              </p>
              <Button variant="outline" className="mt-4" onClick={handleRefreshClusters} disabled={isRegenerating}>
                {isRegenerating ? "Generating..." : "Generate Clusters"}
              </Button>
            </div>
          ) : (
            <div className="h-[300px] w-full bg-muted/10 rounded-md p-4 relative border">
              <div className="grid grid-cols-3 gap-4 h-full">
                {clusters.slice(0, 6).map((cluster, index) => {
                  const size = cluster.contentIds?.length || 1
                  const maxSize = Math.max(...clusters.map((c) => c.contentIds?.length || 1))
                  const relativeSize = (size / maxSize) * 100

                  return (
                    <div
                      key={index}
                      className="bg-primary/10 rounded-lg p-3 flex flex-col justify-center items-center relative cursor-pointer hover:bg-primary/20 transition-colors"
                      style={{
                        height: `${Math.max(30, relativeSize)}%`,
                        margin: "auto",
                      }}
                      onClick={() => handleClusterSelect(cluster)}
                    >
                      <span className="text-xs font-medium mb-1 text-center">{cluster.label}</span>
                      <span className="text-xs">{size} items</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Related Content Tab */}
        <TabsContent value="related" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Source Content</CardTitle>
                <CardDescription>Select content to find semantically similar articles</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedContent ? (
                  <div className="text-center py-12">
                    <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Use semantic search or clusters to select content</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{selectedContent.title}</h4>
                    <p className="text-sm text-muted-foreground mb-4">{selectedContent.content.substring(0, 200)}...</p>
                    <div className="text-xs text-muted-foreground">
                      {new Date(selectedContent.date).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Related Content</CardTitle>
                <CardDescription>Content with similar meaning and topics</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedContent ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Select content to find related articles</p>
                  </div>
                ) : isLoadingRelated ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : relatedContent.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No related content found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {relatedContent.map((content) => (
                      <div key={content._id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{content.title}</h4>
                          <Badge variant="outline" className="ml-2">
                            {Math.round((content.similarityScore || 0) * 100)}% similar
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {content.content.substring(0, 150)}...
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {new Date(content.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>Breakdown of content by semantic topic clusters</CardDescription>
              </CardHeader>
              <CardContent>
                {topicDistribution.length === 0 ? (
                  <div className="flex flex-col items-center justify-center bg-muted/30 rounded-md p-12">
                    <PieChart className="h-16 w-16 text-primary/30 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Topic Distribution Data Unavailable</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Generate content clusters to see how topics are distributed across your content library.
                    </p>
                  </div>
                ) : (
                  <div className="h-[300px] w-full bg-muted/10 rounded-md p-4 border">
                    <div className="h-full flex items-center">
                      <div className="w-full">
                        {topicDistribution.slice(0, 5).map((topic, index) => (
                          <div key={index} className="mb-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">{topic.name}</span>
                              <span className="text-xs">{topic.percentage}%</span>
                            </div>
                            <div className="w-full bg-secondary/50 h-4 rounded-full overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${topic.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Gap Analysis</CardTitle>
                <CardDescription>Identify underrepresented topics in your content</CardDescription>
              </CardHeader>
              <CardContent>
                {topicDistribution.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Generate clusters to see content gap analysis</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-medium">Underrepresented Topics</h3>
                    <div className="space-y-2">
                      {topicDistribution
                        .filter((topic) => topic.percentage < 10)
                        .map((topic, i) => (
                          <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span>{topic.name}</span>
                            <Badge variant="outline">{topic.percentage}%</Badge>
                          </div>
                        ))}

                      {topicDistribution.filter((topic) => topic.percentage < 10).length === 0 && (
                        <p className="text-sm text-muted-foreground">No significantly underrepresented topics found</p>
                      )}
                    </div>

                    <div className="pt-4">
                      <h3 className="font-medium mb-2">Suggested New Topics</h3>
                      <div className="space-y-2">
                        {/* This would be generated by AI based on gaps */}
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Emerging Technology Trends</span>
                            <Button variant="outline" size="sm">
                              Create
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Content about emerging technologies would complement your existing topics
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Industry Case Studies</span>
                            <Button variant="outline" size="sm">
                              Create
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Adding practical case studies would balance your theoretical content
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
