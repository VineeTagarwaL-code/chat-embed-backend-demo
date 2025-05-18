import express, { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import messageRouter from './routes/message';
import cors from 'cors';
import { vercelClient } from './lib/vercel';
import { PineconeClient } from './lib/pinecone';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(globalLimiter);

(async () => {
  try {
    await vercelClient.initialize();
    console.log('Vercel client initialized successfully');

    await PineconeClient.getInstance().initialize();
    console.log('Pinecone client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize clients:', error);
    process.exit(1);
  }
})();

app.use('/api', messageRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Jigsaw Documentation API' });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ message: "OK" });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app; 