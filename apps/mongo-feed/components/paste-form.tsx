"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"

const exampleChats = {
  neutral: `Customer: Hello, I have a question about my recent order.
Agent: Hello, this is Sarah. I'd be happy to help. Can you please provide your order number?
Customer: My order number is 12345.
Agent: Thank you. I've located your order. What specific information do you need?
Customer: I was wondering about the estimated delivery date.
Agent: According to our system, your order is scheduled to be delivered on June 15th.
Customer: Okay, that's what I thought. Thanks for confirming.
Agent: You're welcome. Is there anything else I can assist you with today?
Customer: No, that's all. Thank you.
Agent: Thank you for contacting us. Have a great day!`,

  positive: `Customer: Hi there! I just received my order and I'm absolutely thrilled!
Agent: Hello! This is Mike. I'm so glad to hear that you're happy with your order! What did you particularly like about it?
Customer: Everything! The quality is amazing and it arrived much faster than I expected.
Agent: That's wonderful to hear! We always strive to exceed our customers' expectations. Is there anything specific about the product or service you'd like to highlight?
Customer: Yes, the packaging was eco-friendly, which I really appreciate. And the product itself is even better than described on the website.
Agent: I'm delighted to hear that! We've been working hard on our eco-friendly packaging initiative, and it's great to know it's being noticed and appreciated. I'll make sure to pass your feedback about the product description to our team.
Customer: Please do! You've gained a loyal customer. Thank you so much, Mike!
Agent: You're very welcome! It's customers like you that make our job so rewarding. Is there anything else I can help you with today?
Customer: No, that's all. Thanks again for the great service!
Agent: It's been my pleasure. Thank you for your business and have a fantastic day!`,

  negative: `Customer: I'm extremely frustrated with your service! My order is late and no one seems to care!
Agent: I apologize for the inconvenience. My name is Alex, and I'm here to help. Can you please provide me with your order number?
Customer: It's order number 67890. It was supposed to arrive three days ago!
Agent: I'm sorry to hear that your order is delayed. Let me look into this for you right away.
Customer: This is unacceptable. I needed this for an important event!
Agent: I completely understand your frustration. I see that there was an unexpected delay in our shipping department. While this doesn't excuse the delay, I want to assure you that I'm going to do everything I can to resolve this for you.
Customer: Well, what can you do about it now? The event is tomorrow!
Agent: I sincerely apologize for this situation. Here's what I can do: I'll expedite your shipping to overnight delivery at no extra cost to you. Additionally, I'd like to offer you a 20% discount on your next purchase for the inconvenience caused.
Customer: I appreciate you trying to help, but this really messed up my plans.
Agent: I understand, and I'm truly sorry for the impact this has had on your plans. Is there anything else I can do to help make this situation better for you?
Customer: No, just make sure it arrives tomorrow.
Agent: Absolutely. I've personally flagged this for priority overnight shipping. You'll receive a tracking number within the hour. Again, I'm very sorry for this experience.`,
}

interface Message {
  role: "Customer" | "Agent"
  content: string
}

export function PasteForm() {
  const [content, setContent] = useState(exampleChats.neutral)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const parseConversation = (text: string): Message[] => {
    const lines = text.split("\n").filter((line) => line.trim() !== "")
    const messages: Message[] = []
    let currentRole: "Customer" | "Agent" | null = null
    let currentContent: string[] = []

    for (const line of lines) {
      if (line.startsWith("Customer:") || line.startsWith("Agent:")) {
        if (currentRole && currentContent.length > 0) {
          messages.push({
            role: currentRole,
            content: currentContent.join(" ").trim(),
          })
          currentContent = []
        }
        currentRole = line.startsWith("Customer:") ? "Customer" : "Agent"
        currentContent.push(line.substring(line.indexOf(":") + 1).trim())
      } else if (currentRole) {
        currentContent.push(line.trim())
      }
    }

    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join(" ").trim(),
      })
    }

    return messages
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError("Please enter some chat content before submitting.")
      return
    }

    setIsLoading(true)
    setError(null)

    const messages = parseConversation(content)

    try {
      const response = await fetch("/api/submit-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit chat")
      }

      const { id } = await response.json()
      router.push(`/process-queue?id=${id}`)
    } catch (err) {
      setError("An error occurred while submitting the chat. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="chat-content" className="text-sm font-medium">
            Chat Content
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Paste your chat logs here. Our system will analyze the content using Bedrock LLMs and store the
                  results in MongoDB for quick retrieval.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Format: Start each message with "Customer:" or "Agent:"
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2 mb-2">
          <Badge variant="outline" className="cursor-pointer" onClick={() => setContent(exampleChats.neutral)}>
            Neutral Example
          </Badge>
          <Badge variant="outline" className="cursor-pointer" onClick={() => setContent(exampleChats.positive)}>
            Positive Example
          </Badge>
          <Badge variant="outline" className="cursor-pointer" onClick={() => setContent(exampleChats.negative)}>
            Negative Example
          </Badge>
        </div>
        <Textarea
          id="chat-content"
          placeholder="Paste your chat content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Submitting..." : "Submit Chat"}
      </Button>

      {isLoading && <LoadingSpinner />}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
