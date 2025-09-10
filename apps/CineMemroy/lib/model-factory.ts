import { openai } from "@ai-sdk/openai"
import { google } from "@ai-sdk/google"

interface ModelConfig {
  hasGoogleApiKey: boolean
  openaiApiKey?: string
  googleApiKey?: string
}

class ModelFactory {
  private static instance: ModelFactory | null = null
  private config: ModelConfig | null = null
  private openaiModel: any = null
  private googleModel: any = null
  private chatModel: any = null

  private constructor() {}

  static getInstance(): ModelFactory {
    if (!ModelFactory.instance) {
      ModelFactory.instance = new ModelFactory()
    }
    return ModelFactory.instance
  }

  private loadConfig(): ModelConfig {
    if (this.config) {
      return this.config
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

    this.config = {
      hasGoogleApiKey: !!googleApiKey,
      openaiApiKey,
      googleApiKey
    }

    console.log("[ModelFactory] Configuration loaded:", {
      hasOpenaiKey: !!openaiApiKey,
      hasGoogleKey: !!googleApiKey,
      preferredProvider: this.config.hasGoogleApiKey ? 'Google' : 'OpenAI'
    })

    return this.config
  }

  getOpenAIModel(modelName: string = "gpt-5-nano"): any {
    if (this.openaiModel) {
      return this.openaiModel
    }

    const config = this.loadConfig()
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key is required but not provided")
    }

    console.log("[ModelFactory] Creating OpenAI model:", modelName)
    this.openaiModel = openai(modelName)
    
    return this.openaiModel
  }

  getGoogleModel(modelName: string = "gemini-2.5-flash"): any {
    if (this.googleModel) {
      return this.googleModel
    }

    const config = this.loadConfig()
    if (!config.hasGoogleApiKey) {
      throw new Error("Google API key is required but not provided")
    }

    console.log("[ModelFactory] Creating Google model:", modelName)
    this.googleModel = google(modelName)
    
    return this.googleModel
  }

  getChatModel(): any {
    if (this.chatModel) {
      return this.chatModel
    }

    const config = this.loadConfig()
    
    if (config.hasGoogleApiKey) {
      console.log("[ModelFactory] Using Google model for chat")
      this.chatModel = this.getGoogleModel("gemini-2.5-flash")
    } else {
      console.log("[ModelFactory] Using OpenAI model for chat")
      this.chatModel = this.getOpenAIModel("gpt-5-nano")
    }

    return this.chatModel
  }

  getMemoryDecisionModel(): any {
    // Use the same model as chat for consistency and caching
    return this.getChatModel()
  }

  getDistillationModel(): any {
    // Use the same model as chat for consistency and caching
    return this.getChatModel()
  }

  clearCache(): void {
    console.log("[ModelFactory] Clearing model cache")
    this.openaiModel = null
    this.googleModel = null
    this.chatModel = null
    this.config = null
  }

  getModelInfo(): { provider: string; model: string } {
    const config = this.loadConfig()
    
    if (config.hasGoogleApiKey) {
      return { provider: 'Google', model: 'gemini-2.5-flash' }
    } else {
      return { provider: 'OpenAI', model: 'gpt-5-nano' }
    }
  }
}

export const modelFactory = ModelFactory.getInstance()

// Export convenience functions
export const getChatModel = () => modelFactory.getChatModel()
export const getMemoryDecisionModel = () => modelFactory.getMemoryDecisionModel()
export const getDistillationModel = () => modelFactory.getDistillationModel()
export const getModelInfo = () => modelFactory.getModelInfo()
