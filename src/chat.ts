import express, { Request, Response } from "express";

import { ChatOpenAI } from "@langchain/openai";
import Joi from "joi";
import { Pinecone } from "@pinecone-database/pinecone";
import { PromptTemplate } from "@langchain/core/prompts";
import axios from "axios";
import { config } from "dotenv";
import { loadQAChain } from "langchain/chains";
import { rateLimit } from "express-rate-limit";

config();

const router = express.Router();
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Rate limiter configuration
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 20, // limit each IP to 50 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
});

// Request validation schema
const chatRequestSchema = Joi.object({
  id: Joi.string().required(),
  messages: Joi.array().items(
    Joi.object({
      content: Joi.string().required(),
      parts: Joi.array().items(),
      role: Joi.string().valid('user', 'assistant', 'system').default('user'),
    })
  ).min(1).required(),
});

// Apply rate limiter to chat endpoint
router.post("/chat", chatLimiter, async (req: Request, res: Response): Promise<any> => {
  try {
    // Validate request
    const { error, value } = chatRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { messages } = value;
    const lastMessage = messages[messages.length - 1]?.content;

    if (!lastMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Set up streaming headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Embed the query
    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        input: lastMessage,
        model: "text-embedding-3-small",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const queryEmbedding = openaiResponse.data.data[0].embedding;

    // Query Pinecone
    const index = pinecone.Index("jigsaw-docs");
    const results = await index.query({
      topK: 3,
      vector: queryEmbedding,
      includeMetadata: true,
    });

    // Emit sources first
    const sources = results.matches.map((match: any) => ({
      title: match.metadata?.title || "Unknown",
      file_path: match.metadata?.file_path || "Unknown",
      score: match.score,
    }));
    const context = results.matches
      .map((match: any) => match.metadata?.text || "")
      .join("\n\n");

    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4",
      temperature: 0.7,
      streaming: true,
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          },
          handleLLMEnd() {
            res.write(`event: end\ndata: {}\n\n`);
            res.end();
          },
          handleLLMError(e: Error) {
            console.error("Stream error:", e);
            res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
            res.end();
          },
        },
      ],
    });

    const prompt = PromptTemplate.fromTemplate(
      `You are a knowledgeable and helpful assistant that answers user questions based strictly on the provided documentation.

Documentation Context:
{context}

User Question:
{question}

Instructions:
- Answer using only the information provided in the context.
- Add proper citations to the sources used to answer the question.
- Add proper spacing between sentences.
- Format the answer in a way that is easy to read.
- Use **Markdown formatting** for clarity.
- Quote any **code snippets**, **functions**, **classes**, or **configurations** from the context using fenced code blocks (\`\`\`).
- If referring to a specific line or section, quote it and explain clearly.
- If the answer is not present in the context, reply with:
  > The documentation does not provide enough information to answer this question.
- Be concise, accurate, and avoid guessing or adding external information.

Answer:`
    );

    const chain = loadQAChain(llm, {
      type: "stuff",
      prompt,
    });

    await chain.invoke({
      input_documents: [{ pageContent: context }],
      question: lastMessage,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;