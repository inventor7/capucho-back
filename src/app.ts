import express, { Application } from "express";
import path from "path";

import config from "./config";
import logger, { requestLogger } from "./utils/logger";

import {
  securityHeaders,
  corsMiddleware,
  rateLimiter,
  sanitizeRequest,
} from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import apiRoutes from "./routes";

const app: Application = express();

app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(rateLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(requestLogger);

app.use(sanitizeRequest);

app.use("/bundles", express.static(path.join(__dirname, "..", "uploads")));

app.use("/", apiRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "admin-csp-compliant.html"));
});

app.use(notFoundHandler);

app.use(errorHandler);

let server: Application;

server = app;
logger.info("Starting HTTP server");

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
    console.log(`🔗 Admin interface: http://localhost:${config.port}`);
    console.log(`📊 Health check: http://localhost:${config.port}/health`);
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
