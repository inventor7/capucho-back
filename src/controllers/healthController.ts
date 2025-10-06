import { Request, Response } from "express";
import { HealthResponse, ISupabaseService } from "@/types";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

/**
 * Controller for handling health check operations
 */
class HealthController {
  /**
   * Creates an instance of HealthController
   * @param supabaseService - Service for database operations
   */
  constructor(private readonly supabaseService: ISupabaseService) {}

  /**
   * Health check for the update service
   * GET /api/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test database connection
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

  /**
   * Basic health check
   * GET /health
   */
  async basicHealthCheck(req: Request, res: Response): Promise<void> {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      const result = await this.supabaseService.query("updates", {
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

// Export singleton instance
export default new HealthController(supabaseService);
