import { Request, Response } from "express";
import { ChannelResponse, ValidationError, IUpdateService } from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";
import { extractChannelRequest } from "@/middleware/fieldNormalizer";

class ChannelController {
  constructor(private readonly updateService: IUpdateService) {}

  /**
   * POST /channel_self - Assign device to a channel
   * Official Capgo plugin method
   */
  async assignChannel(req: Request, res: Response): Promise<void> {
    try {
      const normalized = extractChannelRequest(req.body);

      logger.info("Assigning channel to device", {
        channel: normalized.channel,
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (
        !normalized.channel ||
        !normalized.deviceId ||
        !normalized.appId ||
        !normalized.platform
      ) {
        throw new ValidationError(
          "Missing required parameters: channel, device_id, app_id, platform"
        );
      }

      await this.updateService.assignChannel({
        channel: normalized.channel,
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
      });

      // Official Capgo response format
      const response: ChannelResponse = {
        channel: normalized.channel,
        status: "override",
        allowSet: true,
      };

      res.json(response);
    } catch (error) {
      logger.error("Channel assignment failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to assign channel" });
      }
    }
  }

  /**
   * PUT /channel_self - Get current device channel
   * Official Capgo plugin method
   */
  async getDeviceChannel(req: Request, res: Response): Promise<void> {
    try {
      // Can come from body (PUT) or query (GET)
      const normalized = extractChannelRequest({
        ...req.query,
        ...req.body,
      });

      logger.info("Getting device channel", {
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (!normalized.deviceId || !normalized.appId || !normalized.platform) {
        throw new ValidationError(
          "Missing required parameters: device_id, app_id, platform"
        );
      }

      const result = await this.updateService.getDeviceChannel({
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform,
      });

      // Official Capgo response format
      const response: ChannelResponse = {
        channel: result.channel || normalized.defaultChannel || "production",
        status: result.channel ? "override" : "default",
        allowSet: true,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get device channel failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        query: req.query,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to retrieve channel" });
      }
    }
  }

  /**
   * GET /channel_self - List available channels
   * Official Capgo plugin method
   */
  async listChannels(req: Request, res: Response): Promise<void> {
    try {
      const normalized = extractChannelRequest(req.query as any);

      logger.info("Getting available channels", {
        appId: normalized.appId,
        platform: normalized.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (!normalized.appId || !normalized.platform) {
        throw new ValidationError(
          "Missing required parameters: app_id, platform"
        );
      }

      const result = await this.updateService.getAvailableChannels({
        appId: normalized.appId,
        platform: normalized.platform,
      });

      // Official Capgo response format
      res.json(result);
    } catch (error) {
      logger.error("Get available channels failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to retrieve channels" });
      }
    }
  }

  /**
   * DELETE /channel_self - Remove device from channel (reset to default)
   * Official Capgo plugin method
   */
  async unsetChannel(req: Request, res: Response): Promise<void> {
    try {
      const normalized = extractChannelRequest(req.query as any);

      logger.info("Unsetting device channel", {
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (!normalized.deviceId || !normalized.appId) {
        throw new ValidationError(
          "Missing required parameters: device_id, app_id"
        );
      }

      // Reset to default channel (production)
      await this.updateService.assignChannel({
        channel: "production",
        deviceId: normalized.deviceId,
        appId: normalized.appId,
        platform: normalized.platform || "android",
      });

      res.status(200).json({ status: "ok" });
    } catch (error) {
      logger.error("Unset channel failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to unset channel" });
      }
    }
  }

  // Legacy method for backwards compatibility with dashboard
  async getAvailableChannels(req: Request, res: Response): Promise<void> {
    return this.listChannels(req, res);
  }
}

export default new ChannelController(updateService);
