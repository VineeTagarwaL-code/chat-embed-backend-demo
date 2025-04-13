import express, { Request, Response } from 'express';

import chatRouter from './chat';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

const app = express();
const port = process.env.PORT || 3001;

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter); // Apply rate limiting globally

// Routes
app.use('/api', chatRouter);

// Test route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Jigsaw Documentation API' });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ message: "OK" });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app; 