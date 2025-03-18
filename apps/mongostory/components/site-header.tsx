"use client"

import Link from "next/link"
import { Database, LogOut, User, Network } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/hooks/use-media-query"

export function SiteHeader() {
  const { user, logout } = useAuth()
  const isMobile = useMediaQuery("(max-width: 768px)")

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-bold tracking-tighter text-primary">
            {isMobile ? "MS" : "MongoStory"}
          </Link>
        </div>

        {/* Desktop Navigation - Hidden on Mobile */}
        <nav className="hidden md:flex gap-6">
          <Link
            href="/dashboard/content"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Content
          </Link>
          <Link
            href="/dashboard/analytics"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Analytics
          </Link>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Settings
          </Link>
          <Link
            href="/dashboard/content-intelligence"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary flex items-center gap-2"
          >
            <Network className="h-4 w-4" />
            Content Intelligence
          </Link>
          <Link
            href="/dashboard/mongodb-schema"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            MongoDB Models
          </Link>
        </nav>

        <div>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full bg-green-800 text-white hover:bg-green-700"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="default">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
