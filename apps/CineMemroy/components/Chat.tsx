"use client"

import type React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MovieCard } from "@/components/MovieCard"
import { 
  Conversation, 
  ConversationContent 
} from "@/components/conversation"
import { 
  Message, 
  MessageContent 
} from "@/components/message"
import { Response } from "@/components/response"
import { Task, TaskTrigger, TaskContent } from "@/components/task"
import { Tool, ToolHeader, ToolContent, ToolOutput, ToolInput } from "@/components/tool"
import { 
  InlineCitation, 
  InlineCitationText, 
  InlineCitationCard, 
  InlineCitationCardTrigger, 
  InlineCitationCardBody,
  InlineCitationSource
} from "@/components/inline-citation"
import { Badge } from "@/components/ui/badge"
import { BrainIcon, DatabaseIcon, ListIcon, MemoryStickIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface ChatProps {
  userId: string
}

export default function Chat({ userId }: ChatProps) {
  const [input, setInput] = useState("")
  const [threadId] = useState(() => {
    // Generate a consistent threadId for this chat session
    return `session-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  })
  const [messageMemoryOps, setMessageMemoryOps] = useState<Record<string, any>>({})
  const [greeting, setGreeting] = useState<string | null>(null)
  const [greetingLoaded, setGreetingLoaded] = useState(false)

  console.log("[v0] Chat component initialized with threadId:", threadId)

  // Create a custom transport that includes userId and threadId in the request body
  const customTransport = new DefaultChatTransport({
    api: "/api/chat",
    fetch: async (url, options) => {
      console.log("[v0] Custom transport - userId:", userId, "threadId:", threadId)
      const body = JSON.parse(options?.body as string || '{}')
      console.log("[v0] Original request body:", body)
      
      const updatedBody = {
        ...body,
        userId: userId,
        threadId: threadId
      }
      
      console.log("[v0] Updated request body with userId and threadId:", updatedBody)
      
      return fetch(url, {
        ...options,
        body: JSON.stringify(updatedBody)
      })
    }
  })

  const { messages, sendMessage, status, error } = useChat({
    transport: customTransport,
    onError: (error) => {
      console.log("[v0] Chat error:", error)
    },
    onFinish: async ({ message }) => {
      console.log("[v0] Chat finished:", message)
      
      // Fetch memory operations after chat completes
      try {
        console.log("[v0] Fetching memory operations for threadId:", threadId, "userId:", userId)
        const response = await fetch(`/api/memory-operations?threadId=${threadId}&userId=${userId}`)
        console.log("[v0] Memory operations response status:", response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log("[v0] Memory operations received:", data.memoryOperations)
          
          // Store memory operations for this specific message
          if (data.memoryOperations) {
            setMessageMemoryOps(prev => ({
              ...prev,
              [message.id]: data.memoryOperations
            }))
            console.log("[v0] Stored memory operations for message:", message.id)
          }
        } else {
          console.error("[v0] Memory operations request failed:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("[v0] Error fetching memory operations:", error)
      }
    },
    onData: (dataPart) => {
      console.log("[v0] Received data part:", dataPart)
    },
  })

  // Reset greeting state when userId changes
  useEffect(() => {
    setGreeting(null)
    setGreetingLoaded(false)
  }, [userId])

  // Fetch personalized greeting when component mounts and there are no messages
  useEffect(() => {
    const fetchGreeting = async () => {
      if (messages.length === 0 && !greetingLoaded) {
        try {
          console.log("[v0] Fetching personalized greeting for user:", userId)
          const response = await fetch('/api/greeting', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log("[v0] Received greeting:", data.greeting)
            setGreeting(data.greeting)
          } else {
            console.error("[v0] Failed to fetch greeting:", response.status)
            setGreeting("Welcome! I'm your movie recommendation assistant. What kind of films are you in the mood for today?")
          }
        } catch (error) {
          console.error("[v0] Error fetching greeting:", error)
          setGreeting("Welcome! I'm your movie recommendation assistant. What kind of films are you in the mood for today?")
        } finally {
          setGreetingLoaded(true)
        }
      }
    }

    fetchGreeting()
  }, [userId, messages.length, greetingLoaded])

  console.log("[v0] Chat state:", { messagesCount: messages.length, status, error, input })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[v0] Input change event:", e.target.value)
    setInput(e.target.value)
  }

  const onSubmit = (e: React.FormEvent) => {
    console.log("[v0] Form submitted with input:", input)
    console.log("[v0] Current messages before submit:", messages)
    e.preventDefault()
    if (input && input.trim()) {
      console.log("[v0] Calling sendMessage with userId:", userId)
      sendMessage({ text: input })
      setInput("")
    } else {
      console.log("[v0] Empty input, not submitting")
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 mb-4">
        <Conversation>
          <ConversationContent>
            {/* Show personalized greeting when there are no messages */}
            {messages.length === 0 && (
              <>
                {!greeting && !greetingLoaded && (
                  <Message from="assistant">
                    <MessageContent>
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-sm text-muted-foreground">Preparing your personalized greeting...</span>
                      </div>
                    </MessageContent>
                  </Message>
                )}
                
                {greeting && greetingLoaded && (
                  <Message from="assistant">
                    <MessageContent>
                      <div className="animate-in slide-in-from-bottom-2 duration-500">
                        <Response>{greeting}</Response>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </>
            )}
            
            {messages.map((message) => {
              console.log("[v0] Rendering message:", message.id, "role:", message.role, "parts:", message.parts.map(p => p.type))
              return (
                <div key={message.id}>
                <Message from={message.role}>
                  <MessageContent>
                    {/* Render text parts with memory citations */}
                    {message.parts
                      .filter(part => part.type === "text")
                      .map((part, index) => (
                        <div key={`text-${index}`}>
                          {message.role === 'assistant' ? (
                            <InlineCitation>
                              <InlineCitationText>
                                <div>
                                  <Response>{part.text}</Response>
                                  
                                  {/* Extract and display movie cards from tool results in main response */}
                                  {(() => {
                                    const movieToolParts = message.parts.filter(p => 
                                      p.type.startsWith("tool-") && 
                                      (p.type.includes("searchMoviesByPlot") || 
                                       p.type.includes("getPersonalizedRecommendations") || 
                                       p.type.includes("getRandomMovies") ||
                                       p.type.includes("displayMovieCard"))
                                    )
                                    
                                    const movieCards: any[] = []
                                    
                                    movieToolParts.forEach((toolPart: any) => {
                                      const output = toolPart.output || toolPart.result
                                      
                                      if (output?.success) {
                                        // Handle displayMovieCard results
                                        if (output.movieCard) {
                                          movieCards.push({ ...output.movieCard, displayType: 'full' })
                                        }
                                        
                                        // Handle search results
                                        if (output.movies) {
                                          output.movies.forEach((movie: any) => {
                                            movieCards.push({ ...movie, displayType: 'compact' })
                                          })
                                        }
                                        
                                        // Handle recommendations
                                        if (output.recommendations) {
                                          output.recommendations.forEach((movie: any) => {
                                            movieCards.push({ ...movie, displayType: 'compact' })
                                          })
                                        }
                                      }
                                    })
                                    
                                    if (movieCards.length === 0) return null
                                    
                                    return (
                                      <div className="mt-6 space-y-4">
                                        <div className="border-t pt-4">
                                          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                            🎬 Movie Recommendations
                                          </h3>
                                          <div className="space-y-4">
                                            {movieCards.slice(0, 5).map((movie, index) => (
                                              <MovieCard 
                                                key={`main-${movie.id}-${index}`} 
                                                movie={movie} 
                                                compact={movie.displayType === 'compact'} 
                                              />
                                            ))}
                                            {movieCards.length > 5 && (
                                              <div className="text-center text-sm text-muted-foreground">
                                                And {movieCards.length - 5} more movies available in the tool results above...
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </InlineCitationText>
                              <InlineCitationCard>
                                <InlineCitationCardTrigger 
                                  sources={messageMemoryOps[message.id] ? [
                                    ...messageMemoryOps[message.id].retrieved?.map((op: any) => `mem0://retrieved/${op.category}`) || [],
                                    ...messageMemoryOps[message.id].created?.map((op: any) => `mem0://created/${op.category}`) || []
                                  ] : ['mem0://loading']}
                                >
                                  {messageMemoryOps[message.id] ? 
                                    `${messageMemoryOps[message.id].summary?.totalUsed || 0} used, ${messageMemoryOps[message.id].summary?.totalCreated || 0} created` :
                                    'Loading memories...'
                                  }
                                </InlineCitationCardTrigger>
                                <InlineCitationCardBody>
                                  <div className="p-4 space-y-4">
                                    {messageMemoryOps[message.id] ? (
                                      <>
                                        {/* Retrieved Memories */}
                                        {messageMemoryOps[message.id].retrieved && messageMemoryOps[message.id].retrieved.length > 0 && (
                                          <div>
                                            <h4 className="font-semibold text-sm text-blue-600 mb-2">
                                              📖 Retrieved Memories ({messageMemoryOps[message.id].retrieved.length})
                                            </h4>
                                            {messageMemoryOps[message.id].retrieved.map((op: any, opIndex: number) => (
                                              <InlineCitationSource
                                                key={`retrieved-${opIndex}`}
                                                title={`${op.category.charAt(0).toUpperCase() + op.category.slice(1)} Memory`}
                                                description={op.content}
                                                url={`Used from ${new Date(op.timestamp).toLocaleDateString()}`}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        
                                        {/* Created Memories */}
                                        {messageMemoryOps[message.id].created && messageMemoryOps[message.id].created.length > 0 && (
                                          <div>
                                            <h4 className="font-semibold text-sm text-green-600 mb-2">
                                              💾 Memory Operations ({messageMemoryOps[message.id].created.length})
                                            </h4>
                                            {messageMemoryOps[message.id].created.map((op: any, opIndex: number) => (
                                              <InlineCitationSource
                                                key={`created-${opIndex}`}
                                                title={`${op.action || 'CREATE'}: ${op.category.charAt(0).toUpperCase() + op.category.slice(1)} Memory`}
                                                description={op.content}
                                                url={`${op.reasoning || 'Memory operation'} | ${new Date(op.timestamp).toLocaleTimeString()}`}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        Loading memory operations...
                                      </div>
                                    )}
                                  </div>
                                </InlineCitationCardBody>
                              </InlineCitationCard>
                            </InlineCitation>
                          ) : (
                            <Response>{part.text}</Response>
                          )}
                        </div>
                      ))}
                    
                    {/* Consolidated tool execution display */}
                    {(() => {
                      const hasStepStart = message.parts.some(part => part.type === "step-start")
                      const toolParts = message.parts.filter(part => part.type.startsWith("tool-"))
                      
                      // Group tools by unique tool call ID to avoid duplicates
                      const uniqueTools = toolParts.reduce((acc, part, index) => {
                        const toolPart = part as any
                        const toolId = toolPart.toolCallId || `${part.type}-${index}`
                        
                        if (!acc[toolId] || (toolPart.state && toolPart.state !== acc[toolId].state)) {
                          acc[toolId] = { ...toolPart, type: part.type, originalIndex: index }
                        }
                        return acc
                      }, {} as Record<string, any>)
                      
                      const uniqueToolArray = Object.values(uniqueTools)
                      
                      if (!hasStepStart && uniqueToolArray.length === 0) return null
                      
                      return (
                        <Task defaultOpen={true}>
                          <TaskTrigger title="AI is executing tools..." />
                          <TaskContent>
                            {hasStepStart && (
                              <div className="text-sm text-muted-foreground mb-4">
                                Starting multi-step tool execution...
                              </div>
                            )}
                            
                            {uniqueToolArray.map((toolPart, index) => {
                              console.log("[v0] Rendering consolidated tool:", toolPart.type, "state:", toolPart.state)
                              
                              // Determine the actual state
                              let actualState = toolPart.state
                              if (!actualState) {
                                if (toolPart.isError || toolPart.errorText) {
                                  actualState = "output-error"
                                } else if (toolPart.output || toolPart.result) {
                                  actualState = "output-available"
                                } else if (toolPart.input) {
                                  actualState = "input-available"
                                } else {
                                  actualState = "input-streaming"
                                }
                              }
                              
                              return (
                                <Tool key={`consolidated-tool-${index}`} defaultOpen={actualState === "output-error"}>
                                  <ToolHeader 
                                    type={toolPart.type as `tool-${string}`}
                                    state={actualState}
                                  />
                                  <ToolContent>
                                    {toolPart.input && (
                                      <ToolInput input={toolPart.input} />
                                    )}
                                    {(toolPart.output || toolPart.result) && (
                                      <>
                                        <ToolOutput 
                                          output={JSON.stringify(toolPart.output || toolPart.result, null, 2)}
                                          errorText={toolPart.isError || toolPart.errorText ? (toolPart.errorText || "Tool execution failed") : undefined}
                                        />
                                        
                                        {/* Render movie cards for movie tool results */}
                                        {(() => {
                                          const output = toolPart.output || toolPart.result
                                          
                                          // Handle displayMovieCard tool output
                                          if (toolPart.type === "tool-displayMovieCard" && output?.success && output?.movieCard) {
                                            return (
                                              <div className="p-4">
                                                <MovieCard movie={output.movieCard} compact={false} />
                                              </div>
                                            )
                                          }
                                          
                                          // Handle searchMoviesByPlot tool output
                                          if (toolPart.type === "tool-searchMoviesByPlot" && output?.success && output?.movies) {
                                            return (
                                              <div className="p-4 space-y-4">
                                                <h4 className="font-semibold text-sm">Found Movies:</h4>
                                                {output.movies.slice(0, 3).map((movie: any) => (
                                                  <MovieCard key={movie.id} movie={movie} compact={true} />
                                                ))}
                                                {output.movies.length > 3 && (
                                                  <div className="text-sm text-muted-foreground text-center">
                                                    And {output.movies.length - 3} more movies...
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          }
                                          
                                          // Handle getPersonalizedRecommendations tool output
                                          if (toolPart.type === "tool-getPersonalizedRecommendations" && output?.success && output?.recommendations) {
                                            return (
                                              <div className="p-4 space-y-4">
                                                <h4 className="font-semibold text-sm">Personalized Recommendations:</h4>
                                                {output.recommendations.slice(0, 3).map((movie: any) => (
                                                  <MovieCard key={movie.id} movie={movie} compact={true} />
                                                ))}
                                                {output.recommendations.length > 3 && (
                                                  <div className="text-sm text-muted-foreground text-center">
                                                    And {output.recommendations.length - 3} more recommendations...
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          }
                                          
                                          // Handle getRandomMovies tool output
                                          if (toolPart.type === "tool-getRandomMovies" && output?.success && output?.movies) {
                                            return (
                                              <div className="p-4 space-y-4">
                                                <h4 className="font-semibold text-sm">Random Movie Suggestions:</h4>
                                                {output.movies.slice(0, 3).map((movie: any) => (
                                                  <MovieCard key={movie.id} movie={movie} compact={true} />
                                                ))}
                                              </div>
                                            )
                                          }
                                          
                                          return null
                                        })()}
                                      </>
                                    )}
                                    {actualState === "input-streaming" && (
                                      <div className="p-4 text-sm text-muted-foreground">
                                        <div className="flex items-center space-x-2">
                                          <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                                          </div>
                                          <span>Preparing tool execution...</span>
                                        </div>
                                      </div>
                                    )}
                                    {actualState === "input-available" && !toolPart.output && !toolPart.result && (
                                      <div className="p-4 text-sm text-muted-foreground">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                          <span>Executing tool...</span>
                                        </div>
                                      </div>
                                    )}
                                  </ToolContent>
                                </Tool>
                              )
                            })}
                          </TaskContent>
                        </Task>
                      )
                    })()}
                    
                    {/* Render movie data parts as MovieCard components */}
                    {message.parts
                      .filter(part => part.type === "data-movie")
                      .map((part, index) => {
                        const moviePart = part as any // Type assertion for data parts
                        return (
                          <div key={`movie-${index}`} className="mt-4">
                            <MovieCard movie={moviePart.data} compact={true} />
                          </div>
                        )
                      })}
                  </MessageContent>
                </Message>
                
              </div>
              )
            })}
            
            {(status === "submitted" || status === "streaming") && (
              <Task defaultOpen={true}>
                <TaskTrigger title="AI is processing your request..." />
                <TaskContent>
                  <div className="text-sm text-muted-foreground">
                    Analyzing your message and generating a response...
                  </div>
                </TaskContent>
              </Task>
            )}
            
            {error && (
              <Card className="p-4 bg-destructive text-destructive-foreground mr-12">
                <div className="text-sm font-medium mb-2">Error</div>
                <div>{error.message}</div>
              </Card>
            )}
            
          </ConversationContent>
        </Conversation>
      </ScrollArea>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me about movies, get recommendations, or rate films you've watched..."
          disabled={status !== "ready"}
          className="flex-1"
        />
        <Button type="submit" disabled={status !== "ready"}>
          Send
        </Button>
      </form>
    </div>
  )
}
