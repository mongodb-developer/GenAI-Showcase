import { NextResponse } from "next/server"
import { sign } from "jsonwebtoken"
import { scryptSync } from "crypto"
import clientPromise from "@/lib/mongodb"

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined")
}

// Utility function to verify password
function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, storedHash] = hashedPassword.split(":")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return hash === storedHash
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    // Find user by email
    const user = await db.collection("users").findOne(
      { email },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          password: 1,
          role: 1,
        },
      },
    )

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const passwordMatch = verifyPassword(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token
    const token = sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role || "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    )

    // Create response
    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
    })

    // Set HTTP-only cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "An error occurred during login" }, { status: 500 })
  }
}
