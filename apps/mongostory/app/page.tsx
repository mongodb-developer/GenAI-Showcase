"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChartIcon, FileText, GlobeIcon, Search, SplitSquareVertical, Tags } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function Page() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleSignIn = () => {
    router.push("/login")
  }

  const handleGetStarted = () => {
    if (user) {
      router.push("/dashboard")
    } else {
      router.push("/login")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-2xl font-bold tracking-tighter text-primary">
              MongoStroy
            </Link>
          </div>

          <nav className="hidden gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Features
            </Link>
            <Link
              href="#about"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              About
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Pricing
            </Link>
            <Link
              href="#contact"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {!user && (
              <Button variant="outline" className="hidden md:inline-flex" onClick={handleSignIn}>
                Sign In
              </Button>
            )}
            <Button onClick={handleGetStarted}>{user ? "Go to Dashboard" : "Get Started"}</Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4">
                  <Link
                    href="#features"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    Features
                  </Link>
                  <Link
                    href="#about"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    About
                  </Link>
                  <Link
                    href="#pricing"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="#contact"
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    Contact
                  </Link>
                  {!user && (
                    <Button variant="ghost" className="justify-start px-2" onClick={handleSignIn}>
                      Sign In
                    </Button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-primary/10 to-background">
          <div className="container flex flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
              Empower Your Content
              <br />
              with AI-Driven Publishing
            </h1>
            <p className="max-w-[700px] text-muted-foreground md:text-xl">
              MongoStroy: The cloud-native SaaS CMS that revolutionizes content creation, distribution, and monetization
              with powerful AI tools.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={handleGetStarted}>
                {user ? "Go to Dashboard" : "Get Started"}
              </Button>
              <Button size="lg" variant="outline" onClick={handleSignIn}>
                Watch Demo
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-8 sm:py-12 md:py-24 lg:py-32">
          <div className="container px-4 sm:px-6 md:px-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter text-center mb-8 sm:mb-12">
              AI-Powered Features
            </h2>
            <div className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<GlobeIcon className="h-8 w-8 text-primary" />}
                title="Auto Translation"
                description="Automatically translate your content to reach a global audience and expand your market reach."
                onClick={() => router.push("/dashboard/content")}
              />
              <FeatureCard
                icon={<FileText className="h-8 w-8 text-primary" />}
                title="Content Summarization"
                description="Generate concise summaries of your articles to improve readability and engagement."
                onClick={() => router.push("/dashboard/content")}
              />
              <FeatureCard
                icon={<Tags className="h-8 w-8 text-primary" />}
                title="Tag Recommendation"
                description="Get AI-powered tag suggestions to improve content discoverability and SEO."
                onClick={() => router.push("/dashboard/content")}
              />
              <FeatureCard
                icon={<BarChartIcon className="h-8 w-8 text-primary" />}
                title="Sentiment Analysis"
                description="Analyze the emotional tone of your content to ensure it resonates with your audience."
                onClick={() => router.push("/dashboard/analytics")}
              />
              <FeatureCard
                icon={<Search className="h-8 w-8 text-primary" />}
                title="SEO Optimization"
                description="Optimize your content for search engines to improve visibility and organic traffic."
                onClick={() => router.push("/dashboard/content")}
              />
              <FeatureCard
                icon={<SplitSquareVertical className="h-8 w-8 text-primary" />}
                title="A/B Headline Testing"
                description="Test multiple headlines to determine the most effective one for your audience."
                onClick={() => router.push("/dashboard/content")}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function FeatureCard({ icon, title, description, onClick }) {
  return (
    <div
      className="bg-primary/5 rounded-lg shadow-lg p-6 flex flex-col items-center text-center transition-all hover:bg-primary/10 hover:shadow-xl cursor-pointer"
      onClick={onClick}
    >
      <div className="rounded-full bg-primary/10 p-3 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
