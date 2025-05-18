import { config } from "dotenv";

config();

// Environment variables
export const ENV:{
    PINECONE: {
        INDEX_NAME: string;
        API_KEY: string;
    },
    OPENAI: {
        API_KEY: string;
    },
    NODE_ENV: string;
    PORT: string;


} = {
    PINECONE: {
        INDEX_NAME: process.env.PINECONE_INDEX_NAME!,
        API_KEY: process.env.PINECONE_API_KEY!,
    },
    OPENAI:{
        API_KEY: process.env.OPENAI_API_KEY!,
    },
    NODE_ENV: process.env.NODE_ENV!,
    PORT: process.env.PORT!,
}