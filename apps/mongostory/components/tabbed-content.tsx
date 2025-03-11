"use client"

import { useState, type ReactNode } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"

interface Tab {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface TabbedContentProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export function TabbedContent({ tabs, defaultTab, className }: TabbedContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className}>
      <Card className="mb-6">
        <TabsList className="w-full justify-start overflow-x-auto p-1 flex-nowrap">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 whitespace-nowrap">
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Card>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-0">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}

