"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CodeBlock } from "./code-block"
import { Button } from "@/components/ui/button"

interface InfoTooltipProps {
  content: string
  query?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

export function InfoTooltip({ content, query, side = "right", align = "center" }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  return (
    <TooltipProvider>
      <Tooltip open={isOpen}>
        <TooltipTrigger asChild onClick={handleToggle}>
          <Button variant="ghost" size="sm" className="p-0 h-auto">
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="bg-popover text-popover-foreground p-4 rounded-md shadow-md max-w-md border"
          sideOffset={5}
          alignOffset={5}
        >
          <p className="text-sm">{content}</p>
          {query && <CodeBlock code={query} />}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
