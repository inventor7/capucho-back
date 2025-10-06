import winston from "winston";
import config from "@/config";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Custom format that includes metadata
const customFormat = winston.format.printf((info) => {
  const { timestamp, level, message, ...meta } = info;

  let log = `${timestamp} ${level}: ${message}`;

  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    // Remove Symbol properties that winston adds
    const cleanMeta = Object.keys(meta)
      .filter((key) => typeof key === "string")
      .reduce((obj, key) => {
        obj[key] = meta[key];
        return obj;
      }, {} as any);

    if (Object.keys(cleanMeta).length > 0) {
      log += `\n${JSON.stringify(cleanMeta, null, 2)}`;
    }
  }

  return log;
});

// Create the logger
const logger = winston.createLogger({
  level: config.environment === "prod" ? "info" : "debug",
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
    winston.format.colorize({ all: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
    // Add file transport for production
    ...(config.environment === "prod"
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            format: winston.format.combine(
              winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
              winston.format.json() // Use JSON format for file logs
            ),
          }),
          new winston.transports.File({
            filename: "logs/all.log",
            format: winston.format.combine(
              winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
              winston.format.json()
            ),
          }),
        ]
      : []),
  ],
});

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();

  // Log incoming request
  logger.http(`[REQUEST] ${req.method} ${req.path}`, {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("User-Agent"),
    query: req.query,
    body:
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      typeof req.body === "object"
        ? req.body
        : undefined,
  });

  // Capture the original end method to log all responses
  const originalEnd = res.end;
  res.end = function (chunk: any, encoding: any, callback: any) {
    const duration = Date.now() - startTime;
    logger.http(
      `[RESPONSE] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
      {
        status: res.statusCode,
        duration,
      }
    );
    originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};

export default logger;
