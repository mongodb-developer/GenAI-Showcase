import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verify } from "jsonwebtoken"

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined")
}

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string
    email: string
    role: string
  }
}

export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const token = request.cookies.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify token
    const decoded = verify(token, process.env.JWT_SECRET) as {
      userId: string
      email: string
      role: string
    }

    // Add user to request
    const authenticatedRequest = request as AuthenticatedRequest
    authenticatedRequest.user = decoded

    // Call the handler with the authenticated request
    return handler(authenticatedRequest)
  } catch (error) {
    console.error("Authentication error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
