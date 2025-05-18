import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai";
import { ENV } from "../config/env";

/**
 * Singleton class for managing AI providers
 */
export class Provider {
    private static instance: Provider | null = null;
    private openai: OpenAIProvider | null = null;

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    public static getInstance(): Provider {
        if (!Provider.instance) {
            Provider.instance = new Provider();
        }
        return Provider.instance;
    }

    /**
     * Initialize the OpenAI provider
     * @throws Error if initialization fails
     */
    public async initialize(): Promise<void> {
        try {
            if (!ENV.OPENAI.API_KEY) {
                throw new Error('OpenAI API key is not configured');
            }

            this.openai = createOpenAI({
                apiKey: ENV.OPENAI.API_KEY,
            });
        } catch (error) {
            console.error('Failed to initialize OpenAI provider:', error);
            throw error;
        }
    }

    /**
     * Get the OpenAI provider instance
     * @throws Error if provider is not initialized
     */
    public getOpenAI(): OpenAIProvider {
        if (!this.openai) {
            throw new Error('OpenAI provider is not initialized. Call initialize() first.');
        }
        return this.openai;
    }
}

