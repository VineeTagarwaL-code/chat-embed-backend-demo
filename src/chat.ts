import { ConversationalRetrievalQAChain, loadQAChain } from 'langchain/chains';
import express, { Request, Response } from 'express';

import { ChatOpenAI } from '@langchain/openai';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { PromptTemplate } from '@langchain/core/prompts';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

const router = express.Router();

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// // Initialize OpenAI embeddings
// const embeddings = new OpenAIEmbeddings({
//   openAIApiKey: process.env.OPENAI_API_KEY,
// });

// // Initialize Pinecone vector store
// const vectorStore = new PineconeStore(embeddings, {
//   pineconeIndex: pinecone.Index('jigsaw-docs'),
//   namespace: 'docs',
// });

// // Initialize chat model
// const chatModel = new ChatOpenAI({
//   openAIApiKey: process.env.OPENAI_API_KEY,
//   modelName: 'deepseek-chat',
//   temperature: 0.7,
// });

// // Create the chat chain
// const chain = ConversationalRetrievalQAChain.fromLLM(
//   chatModel,
//   vectorStore.asRetriever(),
//   {
//     returnSourceDocuments: true,
//   }
// );

// Chat endpoint
router.post('/chat', async (req: Request, res: Response): Promise<any> => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial event with sources
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Get embeddings for the query
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        input: message,
        model: 'text-embedding-3-small',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const queryEmbedding = openaiResponse.data.data[0].embedding;

    // Query Pinecone for relevant documents
    const index = pinecone.Index('jigsaw-docs');
    const results = await index.query({
      topK: 3,
      vector: queryEmbedding,
      includeMetadata: true,
    });

    // Send sources event
    sendEvent('sources', {
      sources: results.matches.map((match: any) => ({
        title: match.metadata?.title || 'Unknown',
        file_path: match.metadata?.file_path || 'Unknown',
        score: match.score,
      })),
    });

    // Initialize LLM with streaming
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.7,
      streaming: true,
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            sendEvent('token', { token });
          },
          handleLLMEnd() {
            sendEvent('end', {});
          },
        },
      ],
    });

    // Create prompt template
    const prompt = PromptTemplate.fromTemplate(
      `You are a knowledgeable and helpful assistant that answers user questions based strictly on the provided documentation.

Documentation Context:
{context}

User Question:
{question}

Instructions:
- Answer using only the information provided in the context.
- Use **Markdown formatting** for clarity.
- Quote any **code snippets**, **functions**, **classes**, or **configurations** from the context using fenced code blocks (\`\`\`).
- If referring to a specific line or section, quote it and explain clearly.
- If the answer is not present in the context, reply with:
  > The documentation does not provide enough information to answer this question.
- Be concise, accurate, and avoid guessing or adding external information.

Answer:`
    );

    // Create and run the QA chain
    const chain = loadQAChain(llm, {
      type: 'stuff',
      prompt: prompt,
    });

    // Format context from Pinecone results
    const context = results.matches
      .map((match: any) => match.metadata?.text || '')
      .join('\n\n');

    // Get response from LLM
    await chain.invoke({
      input_documents: [{ pageContent: context }],
      question: message,
    });

    // End the SSE connection
    res.end();
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 