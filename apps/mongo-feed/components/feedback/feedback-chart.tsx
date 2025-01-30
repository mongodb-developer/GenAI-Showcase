"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface FeedbackChartProps {
  data: Array<{
    date: string
    positive: number
    negative: number
    neutral: number
  }>
}

export function FeedbackChart({ data }: FeedbackChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Area type="monotone" dataKey="positive" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" />
        <Area
          type="monotone"
          dataKey="negative"
          stackId="1"
          stroke="hsl(var(--destructive))"
          fill="hsl(var(--destructive))"
        />
        <Area type="monotone" dataKey="neutral" stackId="1" stroke="hsl(var(--muted))" fill="hsl(var(--muted))" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

