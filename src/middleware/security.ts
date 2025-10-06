import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import config from "@/config";

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
});

// CORS middleware
export const corsMiddleware = cors({
  origin: config.security.cors.origin,
  credentials: config.security.cors.credentials,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Rate limiting middleware
export const rateLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request sanitization middleware
export const sanitizeRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove any potential XSS from query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === "string") {
        req.query[key] = (req.query[key] as string).replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
      }
    });
  }

  // Remove any potential XSS from body parameters
  if (req.body && typeof req.body === "object") {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === "string") {
        return obj.replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === "object") {
        const sanitized: any = {};
        Object.keys(obj).forEach((key) => {
          sanitized[key] = sanitizeObject(obj[key]);
        });
        return sanitized;
      }
      return obj;
    };

    req.body = sanitizeObject(req.body);
  }

  next();
};
