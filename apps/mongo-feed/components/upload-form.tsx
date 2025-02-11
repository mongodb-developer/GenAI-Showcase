"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [sentiments, setSentiments] = useState<Array<{ name: string; sentiment: string; type: "product" }>>([])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (
      droppedFile &&
      (droppedFile.type === "application/json" ||
        droppedFile.type === "text/html" ||
        droppedFile.type.startsWith("image/"))
    ) {
      handleFileSelect(droppedFile)
    } else {
      setUploadStatus("error")
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setUploadStatus("idle")
  }

  const handleUpload = async () => {
    if (!file) return

    setUploadStatus("uploading")
    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", "product")

    try {
      const response = await fetch("/api/analyze-feedback", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to analyze feedback")
      }

      const result = await response.json()
      setSentiments(result.sentiments)
      setUploadStatus("success")
      toast({
        title: "Upload Successful",
        description: `Successfully analyzed sentiment for ${result.sentiments.length} items.`,
      })
    } catch (error) {
      console.error("Error processing file:", error)
      setUploadStatus("error")
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Drag and drop your JSON file, HTML scrape, or screenshot here, or
          </p>
          <Button onClick={() => document.getElementById("fileInput")?.click()}>Browse Files</Button>
          <input
            id="fileInput"
            type="file"
            accept="application/json,text/html,image/*"
            className="hidden"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0]
              if (selectedFile) {
                handleFileSelect(selectedFile)
              }
            }}
          />
        </div>
      </div>

      {file && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>
          <Button onClick={handleUpload} disabled={uploadStatus === "uploading"}>
            {uploadStatus === "uploading" ? "Analyzing..." : "Analyze Sentiment"}
          </Button>
        </div>
      )}

      {uploadStatus === "success" && (
        <Alert variant="default" className="border-emerald-500 text-emerald-500">
          <AlertDescription>Successfully analyzed sentiment for {sentiments.length} items.</AlertDescription>
        </Alert>
      )}

      {uploadStatus === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to analyze sentiment. Please try again with a valid JSON file, HTML scrape, or screenshot.
          </AlertDescription>
        </Alert>
      )}

      {sentiments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Sentiment Analysis Results:</h3>
          <ul className="list-disc list-inside">
            {sentiments.map((sentiment, index) => (
              <li key={index} className="text-sm">
                Product {sentiment.name}: <span className="font-medium">{sentiment.sentiment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
