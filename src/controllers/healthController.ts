import { Request, Response } from "express";
import { HealthResponse, ISupabaseService } from "@/types";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

class HealthController {
  constructor(private readonly supabaseService: ISupabaseService) {}

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const dbHealthy = await this.testDatabaseConnection();

      const response: HealthResponse = dbHealthy
        ? {
            status: "healthy",
            message: "Update service is running",
            timestamp: new Date().toISOString(),
            supabase: "connected",
            storage: "configured",
          }
        : {
            status: "unhealthy",
            error: "Database connection failed",
            timestamp: new Date().toISOString(),
          };

      res.status(dbHealthy ? 200 : 503).json(response);
    } catch (error) {
      logger.error("Health check failed", { error });

      const response: HealthResponse = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };

      res.status(503).json(response);
    }
  }

  async basicHealthCheck(req: Request, res: Response): Promise<void> {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
    });
  }

  private async testDatabaseConnection(): Promise<boolean> {
    try {
      await this.supabaseService.query("updates", {
        select: "id",
        limit: 1,
      });
      return true;
    } catch (error) {
      logger.error("Database health check failed", { error });
      return false;
    }
  }
}

export default new HealthController(supabaseService);
