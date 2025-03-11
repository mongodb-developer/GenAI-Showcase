import { xai } from "@ai-sdk/xai"
import { generateText } from "ai"

interface SocialMediaPost {
  content: string
}

export async function generateSocialMediaPost(
  title: string,
  content: string,
  platform: string,
  articleUrl?: string, // Add articleUrl parameter
): Promise<SocialMediaPost> {
  const model = xai("grok-2-1212")

  const prompt = `Generate a social media post for ${platform} based on this article:
Title: ${title}
Content: ${content}
${articleUrl ? `\nInclude this URL in an appropriate place: ${articleUrl}` : ""}

Generate an engaging post that captures the essence of the article${articleUrl ? " and encourages readers to click through to read more" : ""}.`

  const { text } = await generateText({
    model,
    prompt,
  })

  return { content: text.trim() }
}

