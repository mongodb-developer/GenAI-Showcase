"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Mic, MicOff, ShoppingCart, MapPin, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import useWebRTCAudioSession from "@/hooks/use-webrtc-audio"
import { ecommerceTools, type Product, type Order } from "@/lib/ecommerce-tools"
import { WelcomePopup } from "@/components/welcome-popup"

export default function VoiceGroceryDelivery() {
  const [cartItems, setCartItems] = useState<Array<{ product: Product; quantity: number }>>([])
  const [discussedProducts, setDiscussedProducts] = useState<Product[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [pastOrders, setPastOrders] = useState<Order[]>([])
  const [isOrderPending, setIsOrderPending] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [address, setAddress] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isWelcomePopupOpen, setIsWelcomePopupOpen] = useState(true)
  const conversationRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim()) {
      const products = await ecommerceTools.searchProducts({ query: searchQuery })
      setDiscussedProducts(products)
    }
  }, [searchQuery])

  const {
    status,
    isSessionActive,
    audioIndicatorRef,
    handleStartStopClick,
    registerFunction,
    conversation,
    currentVolume,
  } = useWebRTCAudioSession("alloy", [
    {
      type: "function",
      name: "searchProducts",
      description: "Search for grocery products by name, description, or category",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for product title, description, or category",
          },
          category: {
            type: "string",
            description: "Specific category to search within",
          },
        },
        required: [],
      },
    },
    {
      type: "function",
      name: "getProductDetails",
      description: "Get detailed information about a specific grocery product",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique identifier of the product",
          },
        },
        required: ["productId"],
      },
    },
    {
      type: "function",
      name: "addToCart",
      description: "Add a grocery product to the shopping cart",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The unique identifier of the product to add to cart",
          },
          quantity: {
            type: "integer",
            description: "The quantity of the product to add",
            default: 1,
            minimum: 1,
          },
        },
        required: ["productId"],
      },
    },
    {
      type: "function",
      name: "createOrder",
      description: "Create a new grocery delivery order from the shopping cart",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Delivery address for the order",
          },
        },
        required: ["address"],
      },
    },
  ])

  const handleCreateOrder = useCallback(async () => {
    if (cartItems.length === 0 || !address) return

    setIsOrderPending(true)
    try {
      const newOrder = await ecommerceTools.createOrder(cartItems, address)
      setOrder(newOrder)
      setPastOrders((prevOrders) => [...prevOrders, newOrder])
      setCartItems([])
    } catch (error) {
      console.error("Failed to create order:", error)
    } finally {
      setIsOrderPending(false)
    }
  }, [cartItems, address])

  // Register e-commerce functions
  useEffect(() => {
    registerFunction("searchProducts", async (args) => {
      const products = await ecommerceTools.searchProducts(args)
      setDiscussedProducts(Array.isArray(products) ? products : [products])
      return products
    })
    registerFunction("getProductDetails", ecommerceTools.getProductDetails)
    registerFunction("addToCart", async (args) => {
      const result = await ecommerceTools.addToCart(args)
      setCartItems((prev) => [...prev, { product: result.product, quantity: args.quantity || 1 }])
      return result
    })
    registerFunction("createOrder", handleCreateOrder)
  }, [registerFunction, handleCreateOrder])

  const handleStartStop = useCallback(async () => {
    if (!isSessionActive) {
      setIsConnecting(true)
      try {
        await handleStartStopClick()
      } finally {
        setIsConnecting(false)
      }
    } else {
      handleStartStopClick()
    }
  }, [isSessionActive, handleStartStopClick])

  const categories = ["all", "fruits", "vegetables", "dairy", "bakery", "meat", "pantry"]

  // Fetch random products on initial load
  useEffect(() => {
    const fetchRandomProducts = async () => {
      try {
        const response = await fetch("/api/products?random=true")
        if (!response.ok) {
          throw new Error("Failed to fetch random products")
        }
        const randomProducts = await response.json()
        setDiscussedProducts(randomProducts)
      } catch (error) {
        console.error("Error fetching random products:", error)
      }
    }

    fetchRandomProducts()
  }, [])

  // Scroll to bottom of conversation when it updates
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight
    }
  }, [conversation])

  return (
    <div className="min-h-screen bg-[#F9FBFA] p-4">
      <WelcomePopup isOpen={isWelcomePopupOpen} onClose={() => setIsWelcomePopupOpen(false)} />
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-10 rounded-full p-0">
                  <User className="h-4 w-4" />
                  <span className="sr-only">Open profile</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Past Orders</h4>
                    <p className="text-sm text-muted-foreground">Orders from the current session</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {pastOrders.map((pastOrder, index) => (
                      <div key={index} className="border-b pb-2 mb-2 last:border-b-0">
                        <p className="font-medium">Order #{index + 1}</p>
                        <p className="text-sm">Status: {pastOrder.status}</p>
                        <p className="text-sm">
                          Items: {pastOrder.items.reduce((acc, item) => acc + item.quantity, 0)}
                        </p>
                        <p className="text-sm">Address: {pastOrder.address}</p>
                      </div>
                    ))}
                    {pastOrders.length === 0 && (
                      <p className="text-sm text-muted-foreground">No past orders in this session</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <h1 className="text-3xl font-bold text-[#001E2B]">Voice Grocery Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium text-[#001E2B]">
                {cartItems.reduce((acc, item) => acc + item.quantity, 0)} items
              </span>
            </div>
            <Button
              onClick={handleStartStop}
              variant={isSessionActive ? "destructive" : "default"}
              disabled={isConnecting}
              className={
                isSessionActive
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[#3D4F58] hover:bg-[#001E2B] text-white"
              }
            >
              {isSessionActive ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  <span className="text-white">Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  <span className="text-white">{isConnecting ? "Connecting..." : "Start Voice Assistant"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {status && <div className="text-sm text-muted-foreground mb-4 text-[#001E2B]">Status: {status}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSearch()
                      }
                    }}
                  />
                  <Button onClick={handleSearch}>Search</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-4 space-y-4">
                <h2 className="text-xl font-semibold text-[#001E2B]">
                  {searchQuery ? `Search Results for "${searchQuery}"` : "Featured Products"}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {discussedProducts.map((product) => (
                    <div
                      key={product._id}
                      className="border rounded-xl p-4 flex flex-col items-center text-center hover:border-[#00ED64] transition-colors"
                    >
                      <span className="text-4xl mb-2 text-[#001E2B]">{product.emoji}</span>
                      <h3 className="font-medium text-[#001E2B]">{product.title}</h3>
                      <p className="text-sm text-muted-foreground text-[#001E2B]">{product.price}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-[#001E2B]"
                        onClick={() => ecommerceTools.addToCart({ productId: product._id, quantity: 1 })}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-4 space-y-4">
                <h2 className="text-xl font-semibold text-[#001E2B]">Conversation</h2>
                <div ref={conversationRef} className="h-[200px] overflow-y-auto">
                  {conversation.map((msg, i) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-2`}>
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          msg.role === "user" ? "bg-[#00ED64] text-[#001E2B]" : "bg-[#F3F3F3] text-[#001E2B]"
                        }`}
                      >
                        {msg.text}
                        {msg.status === "speaking" && <span className="ml-2 animate-pulse">●</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-0">
              <CardContent className="p-4 space-y-4">
                <h2 className="text-xl font-semibold text-[#001E2B]">Shopping Cart</h2>
                <div className="h-[200px] overflow-y-auto">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl text-[#001E2B]">{item.product.emoji}</span>
                        <div>
                          <h3 className="font-medium text-[#001E2B]">{item.product.title}</h3>
                          <p className="text-sm text-muted-foreground text-[#001E2B]">
                            {item.quantity} x {item.product.price}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[#001E2B]"
                        onClick={() => {
                          setCartItems((prev) => prev.filter((cartItem) => cartItem.product._id !== item.product._id))
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-[#001E2B]">
                    Delivery Address
                  </Label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="Enter your delivery address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
                {cartItems.length > 0 && (
                  <Button
                    onClick={handleCreateOrder}
                    disabled={isOrderPending || !address}
                    className="bg-[#3D4F58] hover:bg-[#001E2B] text-white w-full"
                  >
                    {isOrderPending ? "Creating Order..." : "Place Order"}
                  </Button>
                )}
              </CardContent>
            </Card>

            {order && (
              <Card className="bg-white shadow-sm border-0">
                <CardContent className="p-4 space-y-4">
                  <h2 className="text-xl font-semibold text-[#001E2B]">Order Created</h2>
                  <p className="text-[#001E2B]">Order ID: {order.id}</p>
                  <p className="text-[#001E2B]">Status: {order.status}</p>
                  <p className="text-[#001E2B]">Created at: {order.createdAt.toLocaleString()}</p>
                  <p className="text-[#001E2B]">Delivery Address: {order.address}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div
          ref={audioIndicatorRef}
          className={`h-2 bg-[#F3F3F3] rounded-full overflow-hidden transition-all ${
            isSessionActive ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="h-full bg-[#00ED64] transition-all duration-100"
            style={{
              width: `${Math.min(currentVolume * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

