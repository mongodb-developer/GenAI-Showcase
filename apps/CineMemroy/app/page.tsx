"use client"

import React, { useState, useEffect } from "react"
import Chat from "@/components/Chat"
import UserIdentification from "@/components/UserIdentification"
import { Button } from "@/components/ui/button"
import { User, LogOut } from "lucide-react"

export default function Home() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  const handleUserIdentified = (username: string) => {
    setCurrentUser(username)
    // Store in localStorage for persistence across browser sessions
    localStorage.setItem('cinememory-user', username)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('cinememory-user')
  }

  // Check for existing user on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem('cinememory-user')
    if (savedUser) {
      setCurrentUser(savedUser)
    }
  }, [])

  if (!currentUser) {
    return <UserIdentification onUserIdentified={handleUserIdentified} />
  }

  return (
    <main className="h-screen flex flex-col">
      {/* Floating Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto max-w-4xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">🎬 CineMemory</h1>
              <p className="text-muted-foreground">Your personal movie critic with memory - discover, rate, and get personalized film recommendations</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="font-medium">{currentUser}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-xs"
              >
                <LogOut className="mr-1 h-3 w-3" />
                Switch User
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Chat Content */}
      <div className="flex-1 container mx-auto max-w-4xl p-4">
        <Chat userId={currentUser} />
      </div>
    </main>
  )
}
