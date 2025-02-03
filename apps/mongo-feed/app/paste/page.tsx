import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PasteForm } from "@/components/paste-form"

export default function PastePage() {
  return (
    <div className="container mx-auto py-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Paste Chat</CardTitle>
          <CardDescription>Paste chat content for analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <PasteForm />
        </CardContent>
      </Card>
    </div>
  )
}

