import { Request, Response } from "express";
import { vercelClient } from "../lib/vercel";
import { PineconeClient } from "../lib/pinecone";

/**
 * Handler for generating embeddings from messages
 */
const messageHandler = async (req: Request, res: Response): Promise<any> => {
    try {
        const { messages } = req.body;
        const userMessage = messages[messages.length - 1]?.content;

        // Validate input
        if (!userMessage || typeof userMessage !== 'string') {
            return res.status(400).json({
                error: 'Invalid input: message is required and must be a string'
            });
        }

        const textStream = await vercelClient.streamText(userMessage);

        // Required headers for Vercel AI SDK /useChat
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        for await (const token of textStream) {
            const payload = JSON.stringify({ text: token });
            res.write(`data: ${payload}\n\n`);
        }

        // Signal the end of stream
        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (error) {
        console.error('Error in message handler:', error);
        return res.status(500).json({ 
            error: 'Failed to generate embeddings' 
        });
    }
}

export default messageHandler;