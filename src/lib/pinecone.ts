import { Index, Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "../config/env";
import { vercelClient } from "./vercel";

/**
 * Singleton class for managing Pinecone client instance
 */
export class PineconeClient {
    private static instance: PineconeClient | null = null;
    private client: Pinecone | null = null;
    private index: string | null = ENV.PINECONE.INDEX_NAME;

    private constructor() {

    }

    /**
     * Get the singleton instance of PineconeClient
     */
    public static getInstance(): PineconeClient {
        if (!PineconeClient.instance) {
            PineconeClient.instance = new PineconeClient();
        }
        return PineconeClient.instance;
    }

    /**
     * Initialize the Pinecone client
     * @throws Error if initialization fails
     */
    public async initialize(): Promise<void> {
        try {
            if (!ENV.PINECONE.API_KEY) {
                throw new Error('Pinecone API key is not configured');
            }

            this.client = new Pinecone({
                apiKey: ENV.PINECONE.API_KEY,
            });
        } catch (error) {
            console.error('Failed to initialize Pinecone client:', error);
            throw error;
        }
    }

    /**
     * Get the Pinecone client instance
     * @throws Error if client is not initialized
     */
    public getClient(): Pinecone {
        if (!this.client) {
            throw new Error('Pinecone client is not initialized. Call initialize() first.');
        }
        return this.client;
    }

    public async query(query: string): Promise<{ contextDocs: string, sources: any[] }> {
        if (!this.index) {
            throw new Error('Pinecone index is not configured');
        }
        if (!this.client) {
            throw new Error('Pinecone client is not initialized. Call initialize() first.');
        }
        const index = this.client.Index(this.index);
        const queryEmbedding = await vercelClient.generateEmbeddings(query);
        const queryRes = await index?.query({
            vector: queryEmbedding,
            topK: 3,
            includeMetadata: true,
        });

        // get the contextDocs and sources in an object 
        const contextDocs = queryRes?.matches.map((match: any) => match.metadata?.text || "").join("\n\n");
        const sources = queryRes?.matches.map((match: any) => ({
            title: match.metadata?.title || "Unknown",
            file_path: match.metadata?.file_path || "Unknown",
            score: match.score,
        }));

        if (!contextDocs || !sources) {
            throw new Error('No context docs or sources found');
        }
        return { contextDocs, sources };
    }
}

