import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { nanoid } from "nanoid"

// Only run middleware on content pages
export const config = {
  matcher: "/content/:id*",
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Get existing visitor ID or create a new one
  let visitorId = request.cookies.get("visitor_id")?.value
  if (!visitorId) {
    visitorId = nanoid()
    // Set cookie with 1 year expiry
    response.cookies.set("visitor_id", visitorId, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }

  // Add visitor ID to headers so we can access it in the page
  response.headers.set("x-visitor-id", visitorId)

  // Only record page views for actual content pages (not API routes)
  const contentIdMatch = request.nextUrl.pathname.match(/^\/content\/([^/]+)$/)
  if (contentIdMatch && contentIdMatch[1]) {
    const contentId = contentIdMatch[1]

    // Record page view using the API route
    try {
      await fetch(`${request.nextUrl.origin}/api/analytics/page-view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentId, visitorId }),
      })
    } catch (error) {
      console.error("Error recording page view:", error)
    }
  }

  return response
}

