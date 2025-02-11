'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CodeBlock } from "./code-block"

interface InfoTooltipProps {
  content: string;
  query?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function InfoTooltip({ content, query, side = 'right', align = 'center' }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-muted-foreground cursor-help inline-block ml-1" />
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
