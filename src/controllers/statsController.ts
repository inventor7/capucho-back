import { Request, Response } from "express";
import { ValidationError, IUpdateService } from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";
import { extractStatsRequest } from "@/middleware/fieldNormalizer";

class StatsController {
  constructor(private readonly updateService: IUpdateService) {}

  /**
   * Log statistics from the Capgo plugin
   * POST /stats
   *
   * Official Capgo plugin sends:
   * - action: 'get', 'set', 'download_fail', 'install', 'fail', etc.
   * - app_id, device_id, version_name, version_build, platform
   * - is_emulator, is_prod
   *
   * Legacy code expects 'status' instead of 'action'
   */
  async logStats(req: Request, res: Response): Promise<void> {
    try {
      // Extract normalized request (handles snake_case and camelCase)
      const normalized = extractStatsRequest(req.body);

      logger.info("Logging statistics", {
        action: normalized.action,
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        version: normalized.version,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Validation - require at minimum deviceId, appId, platform
      if (!normalized.deviceId || !normalized.appId || !normalized.platform) {
        throw new ValidationError(
          "Missing required parameters: device_id, app_id, platform"
        );
      }

      await this.updateService.logStats({
        bundleId: normalized.bundleId,
        action: normalized.action,
        status: normalized.action, // For backwards compatibility
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        version: normalized.version,
      });

      // Official Capgo response format
      res.status(200).json({ status: "success" });
    } catch (error) {
      logger.error("Stats logging failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
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
