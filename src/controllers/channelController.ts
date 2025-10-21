import { Request, Response } from "express";
import {
  ChannelAssignmentRequest,
  ValidationError,
  IUpdateService,
} from "@/types";
import updateService from "@/services/updateService";
import logger from "@/utils/logger";

class ChannelController {
  constructor(private readonly updateService: IUpdateService) {}

  async assignChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channel, deviceId, appId, platform } = req.body;

      logger.info("Assigning channel to device", {
        channel,
        deviceId,
        appId,
        platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

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
      logger.error("Channel assignment failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        channel: req.body.channel,
        deviceId: req.body.deviceId,
        appId: req.body.appId,
        platform: req.body.platform,
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

  async getDeviceChannel(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, appId, platform } = req.query;

      logger.info("Getting device channel", {
        deviceId,
        appId,
        platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

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
      logger.error("Get device channel failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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

  async getAvailableChannels(req: Request, res: Response): Promise<void> {
    try {
      const { appId, platform } = req.query;

      logger.info("Getting available channels", {
        appId,
        platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

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
}

export default new ChannelController(updateService);
