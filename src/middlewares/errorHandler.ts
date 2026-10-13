import type { NextFunction, Request, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('❌ Error:', err.stack || err);

  const statusCode = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
