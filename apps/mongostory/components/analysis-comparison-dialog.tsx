"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react"
import type { Analysis } from "@/types/analysis"

interface AnalysisComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  originalAnalysis: Analysis | null
  revisedAnalysis: Analysis | null
}

interface MetricChange {
  label: string
  original: number
  revised: number
  change: number
  changePercent: number
}

function calculateChange(original: number, revised: number): { change: number; changePercent: number } {
  if (!original || !revised) {
    return { change: 0, changePercent: 0 }
  }
  const change = revised - original
  const changePercent = ((revised - original) / original) * 100
  return { change, changePercent }
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return <ArrowUpIcon className="h-4 w-4 text-green-500" />
  } else if (change < 0) {
    return <ArrowDownIcon className="h-4 w-4 text-red-500" />
  }
  return <MinusIcon className="h-4 w-4 text-muted-foreground" />
}

function MetricComparison({ metric }: { metric: MetricChange }) {
  const isPositive = metric.change > 0
  const isNegative = metric.change < 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{metric.label}</span>
        <div className="flex items-center gap-2">
          <ChangeIndicator change={metric.change} />
          <span
            className={`text-sm font-bold ${
              isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground"
            }`}
          >
            {metric.changePercent > 0 && "+"}
            {metric.changePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Original</span>
            <span className="text-xs font-medium">{metric.original.toFixed(1)}</span>
          </div>
          <Progress value={metric.original * 10} className="h-1.5" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Revised</span>
            <span className="text-xs font-medium">{metric.revised.toFixed(1)}</span>
          </div>
          <Progress value={metric.revised * 10} className="h-1.5" />
        </div>
      </div>
    </div>
  )
}

export function AnalysisComparisonDialog({
  open,
  onOpenChange,
  originalAnalysis,
  revisedAnalysis,
}: AnalysisComparisonDialogProps) {
  // Return early if either analysis is missing
  if (!originalAnalysis?.analyses || !revisedAnalysis?.analyses) {
    return null
  }

  // Calculate changes for all metrics
  const metrics: MetricChange[] = [
    {
      label: "SEO Score",
      original: originalAnalysis.analyses.seo?.score ?? 0,
      revised: revisedAnalysis.analyses.seo?.score ?? 0,
      ...calculateChange(originalAnalysis.analyses.seo?.score ?? 0, revisedAnalysis.analyses.seo?.score ?? 0),
    },
    {
      label: "Readability",
      original: originalAnalysis.analyses.quality?.readabilityScore ?? 0,
      revised: revisedAnalysis.analyses.quality?.readabilityScore ?? 0,
      ...calculateChange(
        originalAnalysis.analyses.quality?.readabilityScore ?? 0,
        revisedAnalysis.analyses.quality?.readabilityScore ?? 0,
      ),
    },
    {
      label: "Clarity",
      original: originalAnalysis.analyses.quality?.clarity ?? 0,
      revised: revisedAnalysis.analyses.quality?.clarity ?? 0,
      ...calculateChange(
        originalAnalysis.analyses.quality?.clarity ?? 0,
        revisedAnalysis.analyses.quality?.clarity ?? 0,
      ),
    },
    {
      label: "Structure",
      original: originalAnalysis.analyses.quality?.structure ?? 0,
      revised: revisedAnalysis.analyses.quality?.structure ?? 0,
      ...calculateChange(
        originalAnalysis.analyses.quality?.structure ?? 0,
        revisedAnalysis.analyses.quality?.structure ?? 0,
      ),
    },
    {
      label: "Engagement",
      original: originalAnalysis.analyses.emotional?.engagement ?? 0,
      revised: revisedAnalysis.analyses.emotional?.engagement ?? 0,
      ...calculateChange(
        originalAnalysis.analyses.emotional?.engagement ?? 0,
        revisedAnalysis.analyses.emotional?.engagement ?? 0,
      ),
    },
    {
      label: "Topic Relevance",
      original: originalAnalysis.analyses.topic?.relevanceScore ?? 0,
      revised: revisedAnalysis.analyses.topic?.relevanceScore ?? 0,
      ...calculateChange(
        originalAnalysis.analyses.topic?.relevanceScore ?? 0,
        revisedAnalysis.analyses.topic?.relevanceScore ?? 0,
      ),
    },
  ]

  // Calculate overall improvement
  const averageImprovement = metrics.reduce((acc, metric) => acc + metric.changePercent, 0) / metrics.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Analysis Comparison</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Overall Improvement
                  <span
                    className={`text-lg ${
                      averageImprovement > 0
                        ? "text-green-500"
                        : averageImprovement < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {averageImprovement > 0 && "+"}
                    {averageImprovement.toFixed(1)}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  {metrics.map((metric) => (
                    <MetricComparison key={metric.label} metric={metric} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Keyword Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Original Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {originalAnalysis.analyses.seo?.keywords?.map((keyword, index) => (
                          <span key={index} className="px-2 py-1 bg-secondary/30 rounded-full text-xs">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Revised Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {revisedAnalysis.analyses.seo?.keywords?.map((keyword, index) => (
                          <span key={index} className="px-2 py-1 bg-primary/20 rounded-full text-xs">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Emotional Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Primary Emotion</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-secondary/20 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground mb-1">Original</p>
                          <p className="font-medium">{originalAnalysis.analyses.emotional?.primaryEmotion}</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-lg text-center">
                          <p className="text-xs text-muted-foreground mb-1">Revised</p>
                          <p className="font-medium">{revisedAnalysis.analyses.emotional?.primaryEmotion}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Emotion Distribution Changes</h4>
                      <div className="space-y-2">
                        {revisedAnalysis.analyses.emotional?.emotionBreakdown?.map((emotion, index) => {
                          const originalEmotion = originalAnalysis.analyses.emotional?.emotionBreakdown?.find(
                            (e) => e.emotion === emotion.emotion,
                          )
                          const change = originalEmotion
                            ? calculateChange(originalEmotion.percentage, emotion.percentage)
                            : { change: emotion.percentage, changePercent: 100 }

                          return (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm">{emotion.emotion}</span>
                              <div className="flex items-center gap-2">
                                <ChangeIndicator change={change.change} />
                                <span
                                  className={`text-sm ${
                                    change.change > 0
                                      ? "text-green-500"
                                      : change.change < 0
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {change.change > 0 && "+"}
                                  {change.change.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

