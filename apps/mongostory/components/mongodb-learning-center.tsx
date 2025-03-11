"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "./code-block"
import { mongodbExamples } from "@/lib/mongodb-examples"
import { Database, Rocket, Search, Layers } from "lucide-react"

export function MongoDBLearningCenter() {
  const [activeCategory, setActiveCategory] = useState("basics")
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({})

  const toggleExplanation = (title: string) => {
    setShowExplanation((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  const categoryIcons = {
    basics: <Database className="h-5 w-5" />,
    advanced: <Rocket className="h-5 w-5" />,
    indexes: <Search className="h-5 w-5" />,
    transactions: <Layers className="h-5 w-5" />,
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">MongoDB Learning Center</h1>

        <Tabs defaultValue="basics" value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid grid-cols-4 mb-8">
            {Object.keys(mongodbExamples).map((category) => (
              <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                {categoryIcons[category as keyof typeof categoryIcons]}
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(mongodbExamples).map(([category, examples]) => (
            <TabsContent key={category} value={category} className="space-y-6">
              {examples.map((example) => (
                <Card key={example.title}>
                  <CardHeader>
                    <CardTitle>{example.title}</CardTitle>
                    <CardDescription>{example.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock code={example.code} />
                    <div className="mt-4">
                      <Button variant="ghost" onClick={() => toggleExplanation(example.title)}>
                        {showExplanation[example.title] ? "Hide" : "Show"} Explanation
                      </Button>
                      {showExplanation[example.title] && (
                        <div className="mt-2 p-4 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">{example.explanation}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}

