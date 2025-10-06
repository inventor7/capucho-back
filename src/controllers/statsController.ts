import { Request, Response } from "express";
import { StatsRequest, ValidationError, IUpdateService } from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";

/**
 * Controller for handling statistics logging operations
 */
class StatsController {
  /**
   * Creates an instance of StatsController
   * @param updateService - Service for logging statistics
   */
  constructor(private readonly updateService: IUpdateService) {}

  /**
   * Log update statistics
   * POST /api/stats
   */
  async logStats(req: Request, res: Response): Promise<void> {
    try {
      const { bundleId, status, deviceId, appId, platform } = req.body;

      // Validation
      if (!bundleId || !status || !deviceId || !appId || !platform) {
        throw new ValidationError("Missing required parameters");
      }

      const statsRequest: StatsRequest = {
        bundleId,
        status,
        deviceId,
        appId,
        platform,
      };

      await this.updateService.logStats(statsRequest);
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Stats logging failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to log stats" });
      }
    }
  }
}

// Export singleton instance
export default new StatsController(updateService);
