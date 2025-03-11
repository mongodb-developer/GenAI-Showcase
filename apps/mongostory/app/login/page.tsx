import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section with Grid Background */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-grid-small-black/[0.2] bg-[length:20px_20px] dark:bg-grid-small-white/[0.2]" />
        {/* Radial Gradient */}
        <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

        {/* Content */}
        <div className="z-10 w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tighter text-primary sm:text-4xl md:text-5xl">MongoStory</h1>
            <p className="mt-4 text-muted-foreground">Sign in to your account to continue</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

