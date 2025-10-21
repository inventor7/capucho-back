import { Request, Response } from "express";
import { StatsRequest, ValidationError, IUpdateService } from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";

class StatsController {
  constructor(private readonly updateService: IUpdateService) {}

  async logStats(req: Request, res: Response): Promise<void> {
    try {
      const { bundleId, status, deviceId, appId, platform } = req.body;

      logger.info("Logging statistics", {
        bundleId,
        status,
        deviceId,
        appId,
        platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

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
      logger.error("Stats logging failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        bundleId: req.body.bundleId,
        status: req.body.status,
        deviceId: req.body.deviceId,
        appId: req.body.appId,
        platform: req.body.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
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
