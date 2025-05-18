import { Request, Response } from 'express';

import morgan from 'morgan';

// Custom token for request body
morgan.token('body', (req: Request) => JSON.stringify(req.body));

// Custom token for response body
morgan.token('response', (req: Request, res: Response) => {
  const responseBody = res.locals.responseBody;
  return responseBody ? JSON.stringify(responseBody) : '';
});

// Custom format
const format =
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :body :response';

// Create the logger
export const morganLogger = morgan(format, {
  stream: {
    write: (message) => {
      console.log(message.trim());
    },
  },
});