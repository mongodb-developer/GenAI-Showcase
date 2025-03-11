import { NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { cookies } from "next/headers"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined")
}

export async function GET() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify token
    const decoded = verify(token, process.env.JWT_SECRET) as {
      userId: string
      email: string
      role: string
    }

    // Get user from database
    const client = await clientPromise
    const db = client.db("mongostory")

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(decoded.userId) },
      {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          bio: 1,
          jobTitle: 1,
          company: 1,
          avatar: 1,
          createdAt: 1,
        },
      },
    )

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "user",
        bio: user.bio || "",
        jobTitle: user.jobTitle || "",
        company: user.company || "",
        avatar: user.avatar || "",
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify token
    const decoded = verify(token, process.env.JWT_SECRET) as {
      userId: string
      email: string
      role: string
    }

    const body = await request.json()
    const { name, bio, jobTitle, company } = body

    // Validate input
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Update user in database
    const client = await clientPromise
    const db = client.db("mongostory")

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(decoded.userId) },
      {
        $set: {
          name,
          bio: bio || "",
          jobTitle: jobTitle || "",
          company: company || "",
          updatedAt: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: decoded.userId,
        name,
        email: decoded.email,
        role: decoded.role,
        bio: bio || "",
        jobTitle: jobTitle || "",
        company: company || "",
      },
    })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

