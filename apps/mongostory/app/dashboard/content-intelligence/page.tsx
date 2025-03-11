"use client"
import { TabbedContent } from "@/components/tabbed-content"
import { Search, Network, RefreshCw, FileText } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export default function ContentIntelligencePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [clusters, setClusters] = useState([])
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [contentItems, setContentItems] = useState([])
  const [selectedContentId, setSelectedContentId] = useState(undefined)
  const [similarContent, setSimilarContent] = useState([])
  const [isFindingSimilar, setIsFindingSimilar] = useState(false)
  const [selectedContent, setSelectedContent] = useState(null)
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false)
  const [isLoadingClusters, setIsLoadingClusters] = useState(false)

  // Function to deduplicate and process clusters
  const processAndDeduplicateClusters = async (rawClusters) => {
    // Create a Map to deduplicate by label
    const uniqueClusters = new Map()

    rawClusters.forEach((cluster) => {
      // If this label already exists, merge contentIds
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchPerformed(true)
    try {
      const response = await fetch(`/api/content/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      })

      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`)
      }

      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error("Error searching content:", error)
      toast({
        title: "Search Error",
        description: "Failed to search content. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const regenerateClusters = async () => {
    setIsRegenerating(true)
    try {
      // Updated endpoint from /api/content/cluster to /api/clusters/regenerate
      const response = await fetch("/api/clusters/regenerate", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed to regenerate clusters: ${response.status}`)
      }

      const data = await response.json()
      toast({
        title: "Success",
        description: "Clusters regenerated successfully",
      })

      // Fetch the updated clusters
      fetchClusters()
    } catch (error) {
      console.error("Error regenerating clusters:", error)
      toast({
        title: "Error",
        description: "Failed to regenerate clusters. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  const fetchClusters = async () => {
    try {
      // Updated endpoint from /api/content/clusters to /api/clusters
      const response = await fetch("/api/clusters")

      if (!response.ok) {
        throw new Error(`Failed to fetch clusters: ${response.status}`)
      }

      const data = await response.json()
      // Process and deduplicate clusters
      const processedClusters = await processAndDeduplicateClusters(data.clusters || [])
      setClusters(processedClusters)
    } catch (error) {
      console.error("Error fetching clusters:", error)
      toast({
        title: "Error",
        description: "Failed to fetch clusters. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingClusters(false)
    }
  }

  useEffect(() => {
    // Fetch clusters on initial load
    fetchClusters()

    const fetchContentItems = async () => {
      try {
        const response = await fetch("/api/content")

        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`)
        }

        const data = await response.json()
        setContentItems(data)
      } catch (error) {
        console.error("Error fetching content items:", error)
        toast({
          title: "Error",
          description: "Failed to fetch content items. Please try again later.",
          variant: "destructive",
        })
      }
    }

    fetchContentItems()
  }, [])

  // Update the findSimilarContent function to use the semantic-search endpoint
  const findSimilarContent = async () => {
    if (!selectedContentId) return

    setIsFindingSimilar(true)
    setIsLoadingSimilar(true)
    try {
      const response = await fetch("/api/content/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: selectedContentId, limit: 5 }),
      })

      if (!response.ok) {
        throw new Error(`Failed to find similar content: ${response.status}`)
      }

      const data = await response.json()
      setSimilarContent(data)
    } catch (error) {
      console.error("Error finding similar content:", error)
      toast({
        title: "Error",
        description: "Failed to find similar content. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsFindingSimilar(false)
      setIsLoadingSimilar(false)
    }
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Content Intelligence</h1>
        <p className="text-muted-foreground">
          Discover insights and connections in your content using AI-powered analysis.
        </p>
      </div>

      <TabbedContent
        tabs={[
          {
            id: "semantic-search",
            label: "Semantic Search",
            icon: <Search className="h-4 w-4" />,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Semantic Search</CardTitle>
                  <CardDescription>Search your content library using natural language queries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search your content..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          "Search"
                        )}
                      </Button>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="space-y-4 mt-6">
                        <h3 className="text-lg font-medium">Search Results</h3>
                        {searchResults.map((result) => (
                          <div key={result._id} className="border rounded-lg p-4">
                            <h4 className="font-medium">{result.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{result.content}</p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline">Score: {result.score?.toFixed(2) || "N/A"}</Badge>
                              <Button variant="link" asChild className="p-0 h-auto">
                                <Link href={`/content/${result._id}`}>View Content</Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {searchPerformed && searchResults.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No results found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ),
          },
          {
            id: "content-clusters",
            label: "Content Clusters",
            icon: <Network className="h-4 w-4" />,
            content: (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle>Content Clusters</CardTitle>
                    <CardDescription>Automatically grouped content based on semantic similarity</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={regenerateClusters} disabled={isRegenerating}>
                    {isRegenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {clusters.length === 0 ? (
                    <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                      <Network className="h-12 w-12 text-primary/40 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Content Clusters Available</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                        Generate AI-powered clusters to organize your content based on semantic similarity and discover
                        content relationships.
                      </p>
                      <Button variant="outline" onClick={regenerateClusters} disabled={isRegenerating}>
                        {isRegenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Clusters...
                          </>
                        ) : (
                          <>
                            <Network className="mr-2 h-4 w-4" />
                            Generate Clusters
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-6 mb-8">
                        {/* Deduplicate clusters by label */}
                        {Array.from(new Map(clusters.map((cluster) => [cluster.label, cluster])).values())
                          .slice(0, 6) // Limit to 6 clusters for better display
                          .map((cluster, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">{cluster.label}</h3>
                                {cluster.keywords?.length > 0 && (
                                  <Badge variant="outline" className="bg-primary/10">
                                    {cluster.keywords.slice(0, 3).join(", ")}
                                  </Badge>
                                )}
                              </div>
                              <div className="grid gap-2">
                                {cluster.items?.slice(0, 2).map((item) => (
                                  <div
                                    key={item._id}
                                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium">{item.title}</h4>
                                      <Badge variant={item.status === "published" ? "default" : "outline"}>
                                        {item.status}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                                    <div className="flex justify-end mt-2">
                                      <Button variant="link" asChild className="p-0 h-auto">
                                        <Link href={`/content/${item._id}`}>View</Link>
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {(cluster.items?.length > 2 || cluster.contentIds?.length > 2) && (
                                  <Button variant="outline" size="sm" className="mt-1">
                                    View all {cluster.items?.length || cluster.contentIds?.length} items
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Cluster Visualization */}
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Cluster Visualization</h3>
                        <div className="h-[300px] w-full bg-muted/10 rounded-md p-4 relative border">
                          <div className="grid grid-cols-3 gap-4 h-full">
                            {/* Deduplicate clusters by label for visualization */}
                            {Array.from(new Map(clusters.map((cluster) => [cluster.label, cluster])).values())
                              .slice(0, 6) // Limit to 6 clusters for visualization
                              .map((cluster, index) => {
                                const size = cluster.contentIds?.length || cluster.items?.length || 1
                                const maxSize = Math.max(
                                  ...Array.from(new Map(clusters.map((c) => [c.label, c])).values()).map(
                                    (c) => c.contentIds?.length || c.items?.length || 1,
                                  ),
                                )
                                const relativeSize = (size / maxSize) * 100

                                return (
                                  <div
                                    key={index}
                                    className="bg-primary/10 rounded-lg p-3 flex flex-col justify-center items-center relative"
                                    style={{
                                      height: `${Math.max(30, relativeSize)}%`,
                                      margin: "auto",
                                    }}
                                  >
                                    <span className="text-xs font-medium mb-1 text-center">{cluster.label}</span>
                                    <span className="text-xs">{size} items</span>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            id: "similar-content",
            label: "Similar Content",
            icon: <RefreshCw className="h-4 w-4" />,
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Similar Content</CardTitle>
                  <CardDescription>Find content similar to a selected item</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="content-select">Select content item</Label>
                      <Select
                        value={selectedContentId}
                        onValueChange={(value) => {
                          setSelectedContentId(value)
                          const selected = contentItems.find((item) => item._id === value)
                          setSelectedContent(selected)
                        }}
                      >
                        <SelectTrigger id="content-select">
                          <SelectValue placeholder="Select a content item" />
                        </SelectTrigger>
                        <SelectContent>
                          {contentItems.map((item) => (
                            <SelectItem key={item._id} value={item._id}>
                              {item.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={findSimilarContent}
                        disabled={!selectedContentId || isFindingSimilar}
                        className="mt-2"
                      >
                        {isFindingSimilar ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Finding similar content...
                          </>
                        ) : (
                          "Find Similar Content"
                        )}
                      </Button>
                    </div>

                    {!selectedContent ? (
                      <div className="text-center py-12 bg-muted/10 rounded-lg border border-dashed">
                        <FileText className="h-12 w-12 text-primary/40 mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Select Content to Find Similar Items</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Choose a content item from the dropdown above to discover semantically similar content across
                          your library.
                        </p>
                      </div>
                    ) : isLoadingSimilar ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-24 w-full" />
                        ))}
                      </div>
                    ) : (
                      similarContent.length > 0 && (
                        <div className="space-y-4 mt-6">
                          <h3 className="text-lg font-medium">Similar Content</h3>
                          {similarContent.map((item) => (
                            <div key={item._id} className="border rounded-lg p-4">
                              <h4 className="font-medium">{item.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant="outline">Similarity: {((item.score || 0) * 100).toFixed(0)}%</Badge>
                                <Button variant="link" asChild className="p-0 h-auto">
                                  <Link href={`/content/${item._id}`}>View Content</Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            ),
          },
        ]}
        defaultTab="semantic-search"
      />
    </div>
  )
}

