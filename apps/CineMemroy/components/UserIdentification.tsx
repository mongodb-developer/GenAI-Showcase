"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Film, User } from 'lucide-react'

interface UserIdentificationProps {
  onUserIdentified: (username: string) => void
}

export function UserIdentification({ onUserIdentified }: UserIdentificationProps) {
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim()) {
      return
    }

    setIsLoading(true)
    
    // Simple validation and cleanup
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    
    // Simulate a brief loading state for better UX
    setTimeout(() => {
      onUserIdentified(cleanUsername)
      setIsLoading(false)
    }, 300)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Film className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">🎬 Welcome to CineMemory</CardTitle>
          <CardDescription>
            Enter your username to get personalized movie recommendations based on your viewing history and preferences
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your unique username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will be used to remember your movie preferences across sessions
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!username.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <User className="mr-2 h-4 w-4" />
                  Start Movie Discovery
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default UserIdentification
