import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request) {
  try {
    const { items, address } = await request.json()

    const client = await clientPromise
    const collection = client.db("ai_shop").collection("orders")

    const order = {
      items: items.map((item: any) => ({
        product: new ObjectId(item.product._id),
        productName: item.product.title,
        quantity: item.quantity,
      })),
      status: "created",
      createdAt: new Date(),
      address,
    }

    const result = await collection.insertOne(order)

    if (!result.insertedId) {
      throw new Error("Failed to insert order")
    }

    return NextResponse.json({
      id: result.insertedId.toString(),
      ...order,
      items: items, // Return the original items with full product info
    })
  } catch (error) {
    console.error("Create Order API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

