export interface Product {
  _id: string
  title: string
  price: string
  description: string
  category: string
  emoji: string
  process: boolean
  score?: number // Optional score field for search results
}

export interface Order {
  id: string
  items: Array<{ product: Product; quantity: number }>
  status: "pending" | "created"
  createdAt: Date
  address: string
}

export const ecommerceTools = {
  searchProducts: async ({ query, category }: { query?: string; category?: string }) => {
    const params = new URLSearchParams()
    if (query) params.append("query", query)
    if (category && category !== "all") params.append("category", category)

    const response = await fetch(`/api/products?${params}`)
    if (!response.ok) {
      throw new Error("Failed to fetch products")
    }
    return response.json()
  },

  getProductDetails: async ({ productId }: { productId: string }) => {
    const response = await fetch(`/api/products?productId=${encodeURIComponent(productId)}`)
    if (!response.ok) {
      throw new Error("Failed to fetch product details")
    }
    return response.json()
  },

  addToCart: async ({ productId, quantity = 1 }: { productId: string; quantity: number }) => {
    const product = await ecommerceTools.getProductDetails({ productId })
    return {
      success: true,
      message: `Added ${quantity} x ${product.title} to cart`,
      product,
    }
  },

  createOrder: async (items: Array<{ product: Product; quantity: number }>, address: string): Promise<Order> => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items, address }),
    })

    if (!response.ok) {
      throw new Error("Failed to create order")
    }

    const order = await response.json()
    return {
      ...order,
      createdAt: new Date(order.createdAt),
    }
  },
}
