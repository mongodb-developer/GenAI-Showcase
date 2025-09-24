
\\import { NextResponse } from "next/server"

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(`OPENAI_API_KEY is not set`)
    }
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-realtime",
        voice: "alloy",
        modalities: ["audio", "text"],
        instructions:
          "Start conversation with the user by saying 'Hello, how can I help you today?' Use the available tools when relevant. After executing a tool, you will need to respond (create a subsequent conversation item) to the user sharing the function result or error. If you do not respond with additional message with function result, user will not know you successfully executed the tool. Speak and respond in english.",
        tool_choice: "auto",
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    console.log("Session data from OpenAI:", data)

    // Return the JSON response to the client
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching session data:", error)
    return NextResponse.json({ error: "Failed to fetch session data" }, { status: 500 })
  }
}
