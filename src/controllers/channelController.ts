import { Request, Response } from "express";
import {
  ChannelAssignmentRequest,
  ChannelResponse,
  ChannelsResponse,
  ValidationError,
  IUpdateService,
} from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";

/**
 * Controller for handling channel management operations
 */
class ChannelController {
  /**
   * Creates an instance of ChannelController
   * @param updateService - Service for channel operations
   */
  constructor(private readonly updateService: IUpdateService) {}

  /**
   * Assign a channel to a device
   * POST /api/channel_self
   */
  async assignChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channel, deviceId, appId, platform } = req.body;

      // Validation
      if (!channel || !deviceId || !appId || !platform) {
        throw new ValidationError("Missing required parameters");
      }

      const assignmentRequest: ChannelAssignmentRequest = {
        channel,
        deviceId,
        appId,
        platform,
      };

      await this.updateService.assignChannel(assignmentRequest);

      res.json({
        status: "success",
        message: `Assigned to channel: ${channel}`,
      });
    } catch (error) {
      logger.error("Channel assignment failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to assign channel" });
      }
    }
  }

  /**
   * Get channel for a device
   * GET /api/channel
   */
  async getDeviceChannel(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, appId, platform } = req.query;

      // Validation
      if (!deviceId || !appId || !platform) {
        throw new ValidationError(
          "Missing required parameters: deviceId, appId, platform"
        );
      }

      const result = await this.updateService.getDeviceChannel({
        deviceId: deviceId as string,
        appId: appId as string,
        platform: platform as string,
      });

      res.json(result);
    } catch (error) {
      logger.error("Get device channel failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to retrieve channel" });
      }
    }
  }

  /**
   * Get all available channels for an app
   * GET /api/channels
   */
  async getAvailableChannels(req: Request, res: Response): Promise<void> {
    try {
      const { appId, platform } = req.query;

      // Validation
      if (!appId || !platform) {
        throw new ValidationError(
          "Missing required parameters: appId, platform"
        );
      }

      const result = await this.updateService.getAvailableChannels({
        appId: appId as string,
        platform: platform as string,
      });

      res.json(result);
    } catch (error) {
      logger.error("Get available channels failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to retrieve channels" });
      }
    }
  }
}

// Export singleton instance
export default new ChannelController(updateService);
