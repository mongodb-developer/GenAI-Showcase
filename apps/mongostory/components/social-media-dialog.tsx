"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Twitter, Facebook, Linkedin, Instagram, Loader2 } from "lucide-react"
import type { SocialMediaPost } from "@/lib/mongodb"

// Update the interface to include status
interface SocialMediaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentId: string
  content: {
    title: string
    content: string
    status?: "draft" | "published" // Add status
  }
}

export function SocialMediaDialog({ open, onOpenChange, contentId, content }: SocialMediaDialogProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("twitter")
  const [postContent, setPostContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [posts, setPosts] = useState<SocialMediaPost[]>([])

  useEffect(() => {
    if (contentId) {
      fetchSocialMediaPosts()
    }
  }, [contentId])

  const fetchSocialMediaPosts = async () => {
    if (!contentId) return

    try {
      const response = await fetch(`/api/social-media-posts?contentId=${contentId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch social media posts")
      }
      const data = await response.json()
      setPosts(data)
    } catch (error) {
      console.error("Error fetching social media posts:", error)
    }
  }

  const handlePublish = async () => {
    if (!contentId) return

    setIsPublishing(true)
    try {
      const response = await fetch("/api/social-media-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentId,
          platform: selectedPlatform,
          content: postContent,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to publish social media post")
      }

      const newPost = await response.json()
      setPosts((prevPosts) => [newPost, ...prevPosts])
      setPostContent("")
      // You might want to show a success message here
    } catch (error) {
      console.error("Error publishing social media post:", error)
      // You might want to show an error message here
    } finally {
      setIsPublishing(false)
    }
  }

  // In the generatePost function, update the fetch call:
  const generatePost = async () => {
    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-social-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: content.title,
          content: content.content,
          platform: selectedPlatform,
          contentId,
          isPublished: content.status === "published",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate social media post")
      }

      const data = await response.json()
      setPostContent(data.content)
    } catch (error) {
      console.error("Error generating social media post:", error)
      // You might want to show an error message to the user here
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Social Media Post</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="platform">Select Platform</Label>
            <RadioGroup
              id="platform"
              value={selectedPlatform}
              onValueChange={setSelectedPlatform}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="twitter" id="twitter" />
                <Label htmlFor="twitter">
                  <Twitter className="h-4 w-4" />
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="facebook" id="facebook" />
                <Label htmlFor="facebook">
                  <Facebook className="h-4 w-4" />
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="linkedin" id="linkedin" />
                <Label htmlFor="linkedin">
                  <Linkedin className="h-4 w-4" />
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="instagram" id="instagram" />
                <Label htmlFor="instagram">
                  <Instagram className="h-4 w-4" />
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="post-content">Post Content</Label>
            <Textarea id="post-content" value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={generatePost} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Post"
            )}
          </Button>
          <Button type="submit" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </DialogFooter>
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Published Posts</h3>
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post._id?.toString()} className="border rounded p-4">
                <p className="text-sm text-gray-500 mb-2">
                  {post.platform} • {new Date(post.publishedAt).toLocaleString()}
                </p>
                <p>{post.content}</p>
                <div className="mt-2 text-sm text-gray-500">
                  Likes: {post.stats.likes} • Shares: {post.stats.shares} • Comments: {post.stats.comments} • Engagement
                  Score: {post.stats.engagementScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
