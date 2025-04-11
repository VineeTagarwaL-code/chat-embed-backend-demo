import express, { Request, Response } from 'express';

import chatRouter from './chat';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', chatRouter);

// Test route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Jigsaw Documentation API' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app; 