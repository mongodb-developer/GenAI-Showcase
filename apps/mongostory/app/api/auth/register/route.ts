import { NextResponse } from "next/server"
import { randomBytes, scryptSync } from "crypto"
import clientPromise from "@/lib/mongodb"

// Utility function to hash password
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("mongostory")

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email })
    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = hashPassword(password)

    // Create user
    const result = await db.collection("users").insertOne({
      name,
      email,
      password: hashedPassword,
      role: "user", // Default role
      createdAt: new Date(),
    })

    if (!result.acknowledged) {
      throw new Error("Failed to create user")
    }

    return NextResponse.json({
      message: "Registration successful",
      userId: result.insertedId.toString(),
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "An error occurred during registration" }, { status: 500 })
  }
}
