"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const openai_1 = require("@langchain/openai");
const joi_1 = __importDefault(require("joi"));
const pinecone_1 = require("@pinecone-database/pinecone");
const prompts_1 = require("@langchain/core/prompts");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = require("dotenv");
const chains_1 = require("langchain/chains");
const express_rate_limit_1 = require("express-rate-limit");
(0, dotenv_1.config)();
const router = express_1.default.Router();
const pinecone = new pinecone_1.Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});
// Rate limiter configuration
const chatLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 1 * 60 * 1000, // 1 minutes
    max: 20, // limit each IP to 50 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests, please try again later." },
});
// Request validation schema
const chatRequestSchema = joi_1.default.object({
    id: joi_1.default.string().required(),
    messages: joi_1.default.array().items(joi_1.default.object({
        content: joi_1.default.string().required(),
        parts: joi_1.default.array().items(),
        role: joi_1.default.string().valid('user', 'assistant', 'system').default('user'),
    })).min(1).required(),
});
// Apply rate limiter to chat endpoint
router.post("/chat", chatLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Validate request
        const { error, value } = chatRequestSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        const { messages } = value;
        const lastMessage = (_a = messages[messages.length - 1]) === null || _a === void 0 ? void 0 : _a.content;
        if (!lastMessage) {
            return res.status(400).json({ error: "Message is required" });
        }
        // Set up streaming headers for Server-Sent Events (SSE)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        // Embed the query
        const openaiResponse = yield axios_1.default.post("https://api.openai.com/v1/embeddings", {
            input: lastMessage,
            model: "text-embedding-3-small",
        }, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
        });
        const queryEmbedding = openaiResponse.data.data[0].embedding;
        // Query Pinecone
        const index = pinecone.Index("jigsaw-docs");
        const results = yield index.query({
            topK: 3,
            vector: queryEmbedding,
            includeMetadata: true,
        });
        // Emit sources first
        const sources = results.matches.map((match) => {
            var _a, _b;
            return ({
                title: ((_a = match.metadata) === null || _a === void 0 ? void 0 : _a.title) || "Unknown",
                file_path: ((_b = match.metadata) === null || _b === void 0 ? void 0 : _b.file_path) || "Unknown",
                score: match.score,
            });
        });
        const context = results.matches
            .map((match) => { var _a; return ((_a = match.metadata) === null || _a === void 0 ? void 0 : _a.text) || ""; })
            .join("\n\n");
        const llm = new openai_1.ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "gpt-4",
            temperature: 0.7,
            streaming: true,
            callbacks: [
                {
                    handleLLMNewToken(token) {
                        res.write(`data: ${JSON.stringify({ token })}\n\n`);
                    },
                    handleLLMEnd() {
                        res.write(`event: end\ndata: {}\n\n`);
                        res.end();
                    },
                    handleLLMError(e) {
                        console.error("Stream error:", e);
                        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
                        res.end();
                    },
                },
            ],
        });
        const prompt = prompts_1.PromptTemplate.fromTemplate(`You are a knowledgeable and helpful assistant that answers user questions based strictly on the provided documentation.

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

Answer:`);
        const chain = (0, chains_1.loadQAChain)(llm, {
            type: "stuff",
            prompt,
        });
        yield chain.invoke({
            input_documents: [{ pageContent: context }],
            question: lastMessage,
        });
    }
    catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}));
exports.default = router;
