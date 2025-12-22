import express, { Application } from "express";

import config from "./config";
import logger from "./utils/logger";

import { configureMiddleware } from "./app/middleware.config";
import { setupRoutes } from "./app/routes.config";
import { setupErrorHandling } from "./app/error-handling.config";
import { setupGracefulShutdown } from "./app/shutdown.config";

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeApp();
  }

  private initializeApp(): void {
    configureMiddleware(this.app);
    setupRoutes(this.app);
    setupErrorHandling(this.app);
    setupGracefulShutdown();
  }

  public start(): void {
    this.app.listen(config.port, () => {
      logger.info("Server started successfully", {
        port: config.port,
        supabaseUrl: config.supabase.url,
        bucketName: config.supabase.bucketName,
      });

      console.log(
        `🚀 Capgo self-hosted update server running on port ${config.port}`
      );
      console.log(`🔗 Admin interface: http://localhost:${config.port}`);
      console.log(`📊 Health check: http://localhost:${config.port}/health`);
    });
  }
}

const app = new App();

export default app.app;
export { app, App };
