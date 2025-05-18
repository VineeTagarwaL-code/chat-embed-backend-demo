import { Provider } from "../provider";
import { OpenAIProvider } from "@ai-sdk/openai";
import { embed, tool, streamText } from "ai";
import { SYSTEM_PROMPT } from "../constant";
import { z } from "zod";
import { PineconeClient } from "./pinecone";
/**
 * Singleton class for managing Vercel integrations
 */
class VercelClient {
    private static instance: VercelClient | null = null;
    private static openai: OpenAIProvider;

    private constructor() {
        // Private constructor to prevent direct instantiation
    }

    /**
     * Get the singleton instance of VercelClient
     */
    public static getInstance(): VercelClient {
        if (!VercelClient.instance) {
            VercelClient.instance = new VercelClient();
        }
        return VercelClient.instance;
    }

    /**
     * Initialize the Vercel client
     * @throws Error if initialization fails
     */
    public async initialize(): Promise<void> {
        try {
            const provider = Provider.getInstance();
            await provider.initialize();
            VercelClient.openai = provider.getOpenAI();
        } catch (error) {
            console.error('Failed to initialize Vercel client:', error);
            throw error;
        }
    }

    /**
     * Get the OpenAI provider instance
     */
    public getOpenAI(): OpenAIProvider {
        if (!VercelClient.openai) {
            throw new Error('Vercel client is not initialized. Call initialize() first.');
        }
        return VercelClient.openai;
    }

    /**
     * Generate embeddings for the given text
     * @param text The text to generate embeddings for
     * @returns The generated embedding vector
     */
    public async generateEmbeddings(text: string) {
        if (!VercelClient.openai) {
            throw new Error('Vercel client is not initialized. Call initialize() first.');
        }

        const embedding = await embed({
            model: VercelClient.openai.embedding("text-embedding-3-small"),
            value: text,
        });
        return embedding.embedding;
    }

    /**
     * Stream text response with context fetching capability
     * @param userMessage The user's message to process
     * @returns Stream of AI responses
     */
    public async streamText(userMessage: string) {
        if (!VercelClient.openai) {
            throw new Error('Vercel client is not initialized. Call initialize() first.');
        }

        // First, get initial context for the user's message
        const initialContext = await PineconeClient.getInstance().query(userMessage);
        
        // Format the prompt with context
        const promptWithContext = `Context:\n${initialContext.contextDocs}\n\nQuestion: ${userMessage}\n\n`
        
        const { textStream } = streamText({
            model: VercelClient.openai("gpt-4o-mini"),
            system: SYSTEM_PROMPT,
            prompt: promptWithContext,
            tools: {
                searchContext: tool({
                    description: "Search for additional context when you need more information to answer the question accurately",
                    parameters: z.object({
                        searchTerm: z.string().describe("The specific term or concept to search for in the documentation"),
                        reason: z.string().describe("Why you need this additional information")
                    }),
                    execute: async ({ searchTerm }) => {
                        try {
                            console.log("Searching for additional context:", searchTerm);
                            const { contextDocs, sources } = await PineconeClient.getInstance().query(searchTerm);
                            return {
                                additionalContext: contextDocs,
                                sources: sources,
                                found: contextDocs.length > 0
                            };
                        } catch (error) {
                            console.error('Error fetching additional context:', error);
                            return {
                                additionalContext: "",
                                sources: [],
                                found: false
                            };
                        }
                    }
                })
            }
        });

        return textStream;
    }
}

// Export a single instance
export const vercelClient = VercelClient.getInstance();