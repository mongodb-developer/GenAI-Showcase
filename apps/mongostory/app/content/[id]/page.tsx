import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { Markdown } from "@/components/ui/markdown"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { LanguageToggle } from "@/components/language-toggle"
import { ViewTracker } from "@/components/view-tracker"

interface ContentPageProps {
  params: {
    id: string
  }
  searchParams: {
    lang?: string
  }
}

async function getContent(id: string) {
  try {
    const client = await clientPromise
    const db = client.db("mongostory")

    const content = await db.collection("content").findOne({
      _id: new ObjectId(id),
      status: "published",
    })

    return content
  } catch (error) {
    console.error("Error fetching content:", error)
    return null
  }
}

export async function generateMetadata({ params, searchParams }: ContentPageProps): Promise<Metadata> {
  const content = await getContent(params.id)

  if (!content) {
    return {
      title: "Content Not Found",
    }
  }

  const translation = searchParams.lang && content.translations?.[searchParams.lang]

  return {
    title: translation?.title || content.title,
    description: content.analysis?.analyses.seo?.description || content.content.substring(0, 160),
  }
}

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const content = await getContent(params.id)

  if (!content) {
    notFound()
  }

  const headersList = headers()
  const visitorId = headersList.get("x-visitor-id")

  const lang = searchParams.lang || "en"
  const translation = lang !== "en" ? content.translations?.[lang] : null

  // If requested language is not available, redirect to English
  if (lang !== "en" && !content.translations?.[lang]) {
    redirect(`/content/${params.id}`)
  }

  const availableLanguages = ["en", ...(content.translations ? Object.keys(content.translations) : [])]

  return (
    <article className="container max-w-3xl py-12">
      <header className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight">{translation?.title || content.title}</h1>
          <LanguageToggle currentLanguage={lang} availableLanguages={availableLanguages} contentId={params.id} />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Published on {new Date(content.publishedAt || content.date).toLocaleDateString()}</span>
          {translation && (
            <>
              <span>•</span>
              <span>
                Translated {translation.translatedBy === "AI" ? "by AI" : "manually"} on{" "}
                {new Date(translation.createdAt).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </header>
      <div className="prose dark:prose-invert max-w-none">
        <Markdown>{translation?.content || content.content}</Markdown>
      </div>
      {visitorId && <ViewTracker contentId={params.id} visitorId={visitorId} />}
    </article>
  )
}

