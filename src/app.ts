import express, { Application } from "express";
import https from "https";
import fs from "fs";
import path from "path";

// Import configuration and utilities
import config from "./config";
import logger, { requestLogger } from "./utils/logger";

// Import middleware
import {
  securityHeaders,
  corsMiddleware,
  rateLimiter,
  sanitizeRequest,
} from "./middleware/security";
import {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from "./middleware/errorHandler";

// Import routes
import apiRoutes from "./routes";

// Create Express application
const app: Application = express();

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1);

// Security middleware
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(rateLimiter);

// Logging middleware
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request sanitization
app.use(sanitizeRequest);

// Static file serving
app.use("/bundles", express.static(path.join(__dirname, "..", "uploads")));

// API routes
app.use("/", apiRoutes);

// Admin interface
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "admin-csp-compliant.html"));
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// SSL configuration
let server: https.Server | Application;

if (
  process.env.NODE_ENV === "production" ||
  fs.existsSync(path.join(__dirname, "..", "server.key"))
) {
  try {
    const sslOptions = {
      key: fs.readFileSync(path.join(__dirname, "..", "server.key")),
      cert: fs.readFileSync(path.join(__dirname, "..", "server.cert")),
    };

    server = https.createServer(sslOptions, app);
    logger.info("SSL enabled server created");
  } catch (error) {
    logger.warn("SSL certificates not found, starting HTTP server", { error });
    server = app;
  }
} else {
  server = app;
  logger.info("Starting HTTP server (development mode)");
}

// Start server
const startServer = () => {
  server.listen(config.port, () => {
    logger.info("Server started successfully", {
      port: config.port,
      environment: config.environment,
      supabaseUrl: config.supabase.url,
      bucketName: config.supabase.bucketName,
    });

    console.log(
      `🚀 Capgo self-hosted update server running on port ${config.port}`
    );
    console.log(`📝 Environment: ${config.environment}`);
    console.log(
      `🔗 Admin interface: http${
        config.environment === "prod" ? "s" : ""
      }://localhost:${config.port}`
    );
    console.log(
      `📊 Health check: http${
        config.environment === "prod" ? "s" : ""
      }://localhost:${config.port}/health`
    );
  });
};

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down server...");
  process.exit(0);
});

export default app;
export { startServer };
