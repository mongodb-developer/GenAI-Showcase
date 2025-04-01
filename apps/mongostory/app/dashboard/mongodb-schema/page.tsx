"use client"

import { useState } from "react"
import { MongoDBSchemaViewer } from "@/components/mongodb-schema-viewer"
import { SchemaViewerSkeleton } from "@/components/skeletons"

export default function MongoDBSchemaPage() {
  const [isLoading, setIsLoading] = useState(true)

  // Simulate loading for demo
  setTimeout(() => setIsLoading(false), 1000)

  if (isLoading) {
    return <SchemaViewerSkeleton />
  }

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">MongoDB Data Models</h1>
      <p className="text-muted-foreground mb-6">
        Explore the MongoDB data models used in MongoStroy to store and manage content, analytics, and system
        configurations.
      </p>

      <MongoDBSchemaViewer />
    </div>
  )
}
