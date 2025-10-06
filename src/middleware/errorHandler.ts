import { Request, Response, NextFunction } from "express";
import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from "@/types";
import logger from "@/utils/logger";

// Error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal server error";
  let isOperational = false;

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;

    // Log operational errors as warnings
    if (isOperational) {
      logger.warn("Operational error", {
        error: message,
        statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
    }
  } else if (error instanceof ValidationError) {
    statusCode = 400;
    message = error.message;
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    message = error.message;
  } else if (error instanceof DatabaseError) {
    statusCode = 500;
    message = "Database operation failed";
  }

  // Log unexpected errors
  if (!isOperational) {
    logger.error("Unexpected error", {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  }

  // Send error response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error.message,
    }),
  });
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper
export const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
