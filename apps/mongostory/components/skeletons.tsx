import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function ContentSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-primary/10 animate-pulse" />
                <div className="h-7 w-48 bg-primary/10 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-9 rounded bg-primary/10 animate-pulse" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="w-9 h-9 rounded bg-primary/10 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-primary/10 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-primary/10 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-40 bg-primary/10 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-primary/10 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="container py-8 space-y-8">
      <div className="h-8 w-48 bg-primary/10 rounded animate-pulse" />
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-primary/10 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-24 bg-primary/10 rounded animate-pulse" />
              <div className="h-10 bg-primary/10 rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function SchemaViewerSkeleton() {
  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-primary/10 rounded animate-pulse" />
          <div className="h-16 bg-primary/10 rounded animate-pulse" />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-primary/10 rounded animate-pulse" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-40 bg-primary/10 rounded animate-pulse" />
            <div className="h-20 bg-primary/10 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
