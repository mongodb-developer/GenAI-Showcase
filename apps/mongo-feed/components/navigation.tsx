'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Upload, MessageSquare, BarChart2, LineChart, PieChart, Lock, Menu, ListChecks } from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()

  const NavContent = () => (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        <div className="space-y-1">
          <h2 className="px-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Input Sources
          </h2>
          <NavItem href="/upload" icon={Upload}>
            Upload Files
          </NavItem>
          <NavItem href="/paste" icon={MessageSquare}>
            Paste Chat
          </NavItem>
        </div>
        <div className="space-y-1">
          <h2 className="px-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Processing
          </h2>
          <NavItem href="/process-queue" icon={ListChecks}>
            Process Queue
          </NavItem>
        </div>
        <div className="space-y-1">
          <h2 className="px-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Insights
          </h2>
          <NavItem href="/feedback" icon={BarChart2}>
            Feedback Analysis
          </NavItem>
          <NavItem href="/sentiment" icon={LineChart}>
            Agent Sentiment
          </NavItem>
          <NavItem href="/charts" icon={PieChart}>
            Charts
          </NavItem>
        </div>
      </div>
    </ScrollArea>
  )

  const NavItem = ({
    href,
    icon: Icon,
    children
  }: {
    href: string
    icon: React.ComponentType<{ className?: string }>
    children: React.ReactNode
  }) => {
    const isActive = pathname === href
    return (
      <Link href={href}>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 font-normal",
            isActive && "bg-muted"
          )}
        >
          <Icon className="h-4 w-4" />
          {children}
        </Button>
      </Link>
    )
  }

  return (
    <>
      {/* Mobile Navigation */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-500" />
              <span className="font-semibold">MONGOFEED</span>
            </div>
          </div>
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Navigation */}
      <div className="hidden md:block w-64 border-r bg-card print:hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold">MONGOFEED</span>
          </div>
        </div>
        <NavContent />
      </div>
    </>
  )
}
