"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Play, Save } from "lucide-react"
import { CodeBlock } from "./code-block"

interface PlaygroundResult {
  success: boolean
  data?: any
  error?: string
}

export function MongoDBPlayground() {
  const [query, setQuery] = useState(`// Example: Find all published content
db.collection('content').find({
  status: "published"
}).toArray()`)
  const [result, setResult] = useState<PlaygroundResult | null>(null)

  const runQuery = async () => {
    try {
      const response = await fetch("/api/mongodb-playground", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      })
    }
  }

  const saveQuery = () => {
    const savedQueries = JSON.parse(localStorage.getItem("savedQueries") || "[]")
    savedQueries.push(query)
    localStorage.setItem("savedQueries", JSON.stringify(savedQueries))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MongoDB Playground</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono min-h-[200px]"
            placeholder="Enter your MongoDB query here..."
          />
          <div className="flex gap-2">
            <Button onClick={runQuery} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Run Query
            </Button>
            <Button variant="outline" onClick={saveQuery} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Query
            </Button>
          </div>
          {result && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Result:</h3>
              {result.success ? (
                <CodeBlock code={JSON.stringify(result.data, null, 2)} />
              ) : (
                <div className="text-red-500 p-4 bg-red-50 rounded-md">Error: {result.error}</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
