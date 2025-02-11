'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Home, Search, Library, Music, Menu, X } from 'lucide-react'
import { UserMenu } from '@/components/user-menu'
import { useUser } from '@/contexts/UserContext'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Navbar() {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)

  const NavItems = () => (
    <>
      <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground">
        <Home className="h-4 w-4 mr-1" />
        Home
      </Link>
      <Link href="/search" className="flex items-center text-muted-foreground hover:text-foreground">
        <Search className="h-4 w-4 mr-1" />
        Search
      </Link>
      <Link href="/library" className="flex items-center text-muted-foreground hover:text-foreground">
        <Library className="h-4 w-4 mr-1" />
        Library
      </Link>
    </>
  )

  return (
    <nav className="bg-background border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold flex items-center">
              <Music className="h-6 w-6 mr-2" />
              MongoMP
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <NavItems />
          </div>
          <div className="flex items-center">
            <UserMenu user={user} />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col space-y-4">
                  <NavItems />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
