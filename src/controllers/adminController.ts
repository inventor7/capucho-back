import { Request, Response } from "express";
import {
  DashboardStatsResponse,
  UpdateRecord,
  ValidationError,
  IFileService,
  ISupabaseService,
} from "@/types";
import fileService from "@/services/fileService";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import semver from "semver";

/**
 * Controller for handling admin operations including file uploads and dashboard APIs
 */
class AdminController {
  /**
   * Creates an instance of AdminController
   * @param fileService - Service for file operations
   * @param supabaseService - Service for database operations
   */
  constructor(
    private readonly fileService: IFileService,
    private readonly supabaseService: ISupabaseService
  ) {}

  /**
   * Upload a new update bundle
   * POST /api/admin/upload
   */
  async uploadBundle(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        platform,
        channel = "stable",
        environment = "prod",
        required = false,
      } = req.body;

      logger.info("Upload bundle request received", {
        version,
        platform,
        channel,
        environment,
        required,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        file: req.file
          ? {
              originalName: req.file.originalname,
              size: req.file.size,
              mimetype: req.file.mimetype,
            }
          : null,
      });

      await this.fileService.validateFile(req.file);

      if (!version || !platform || !semver.valid(version)) {
        throw new ValidationError(
          "Missing or invalid parameters: version, platform (semver required)"
        );
      }

      if (["android", "ios", "web"].indexOf(platform) === -1) {
        throw new ValidationError(
          "Invalid platform. Must be: android, ios, web"
        );
      }

      const buffer =
        req.file!.buffer || require("fs").readFileSync(req.file!.path);
      const checksum = this.fileService.calculateChecksum(buffer);

      const fileName = `bundle-${platform}-${version}-${Date.now()}${require("path").extname(
        req.file!.originalname
      )}`;
      const downloadUrl = await this.fileService.uploadFile(fileName, buffer);

      const updateRecord: Omit<UpdateRecord, "id"> = {
        platform: platform as any,
        version,
        download_url: downloadUrl,
        checksum,
        channel,
        environment: environment as any,
        required: required === "true" || required === true,
        active: true,
        created_by: "admin",
      };

      const insertedRecord = await this.supabaseService.insert("updates", [
        updateRecord,
      ]);

      logger.info("Bundle uploaded successfully", {
        version,
        platform,
        fileName,
        downloadUrl,
        recordId: insertedRecord[0]?.id,
      });

      res.json({
        success: true,
        message: `Version ${version} uploaded successfully`,
        downloadUrl,
        fileName,
        record: insertedRecord[0],
      });
    } catch (error) {
      logger.error("Bundle upload failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        version: req.body.version,
        platform: req.body.platform,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        file: req.file ? req.file.originalname : undefined,
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Upload failed",
          details: (error as Error).message,
        });
      }
    }
  }

  /**
   * Get dashboard statistics
   * GET /api/dashboard/stats
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Fetching dashboard statistics", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const bundlesResult = await this.supabaseService.query("updates", {
        select: "*",
        count: "exact",
      });

      const totalBundles = bundlesResult.count || 0;

      const devicesResult = await this.supabaseService.query(
        "device_channels",
        {
          select: "device_id",
          order: { column: "updated_at" },
        }
      );

      const activeDevices = devicesResult.data
        ? new Set(devicesResult.data.map((d: any) => d.device_id)).size
        : 0;

      const channelsResult = await this.supabaseService.query("updates", {
        select: "channel",
        order: { column: "created_at" },
      });

      const activeChannels = channelsResult.data
        ? new Set(channelsResult.data.map((c: any) => c.channel)).size
        : 0;

      const downloadsResult = await this.supabaseService.query("update_stats", {
        select: "*",
        count: "exact",
        eq: { status: "downloaded" },
      });

      const totalDownloads = downloadsResult.count || 0;

      const stats: DashboardStatsResponse = {
        totalBundles,
        activeDevices,
        activeChannels,
        totalDownloads,
      };

      logger.info("Dashboard stats fetched successfully", stats);
      res.json(stats);
    } catch (error) {
      logger.error("Dashboard stats fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({
        error: "Failed to fetch dashboard statistics",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get all bundles for dashboard
   * GET /api/dashboard/bundles
   */
  async getBundles(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.supabaseService.query("updates", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });

      res.json(result.data || []);
    } catch (error) {
      logger.error("Bundles fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  }

  /**
   * Create a new bundle
   * POST /api/dashboard/bundles
   */
  async createBundle(req: Request, res: Response): Promise<void> {
    try {
      const bundleData = req.body;
      const result = await this.supabaseService.insert("updates", [bundleData]);
      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("Bundle creation failed", { error });
      res.status(500).json({ error: "Failed to create bundle" });
    }
  }

  /**
   * Update a bundle
   * PUT /api/dashboard/bundles/:id
   */
  async updateBundle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update("updates", updateData, {
        id: parseInt(id!),
      });

      if (result.length === 0) {
        throw new ValidationError("Bundle not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Bundle update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update bundle" });
      }
    }
  }

  /**
   * Delete a bundle
   * DELETE /api/dashboard/bundles/:id
   */
  async deleteBundle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("updates", { id: parseInt(id!) });
      res.status(204).send();
    } catch (error) {
      logger.error("Bundle deletion failed", { error });
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  }

  /**
   * Get all channels for dashboard
   * GET /api/dashboard/channels
   */
  async getChannels(req: Request, res: Response): Promise<void> {
    try {
      const updatesResult = await this.supabaseService.query("updates", {
        select: "channel, platform, environment, created_at",
      });

      const allChannelsResult = await this.supabaseService.query(
        "device_channels",
        {
          select: "channel",
        }
      );

      const channelCounts: { [key: string]: number } = {};
      (allChannelsResult.data || []).forEach((item: any) => {
        channelCounts[item.channel] = (channelCounts[item.channel] || 0) + 1;
      });

      const channelMap: { [key: string]: any } = {};
      (updatesResult.data || []).forEach((update: any) => {
        if (!channelMap[update.channel]) {
          channelMap[update.channel] = {
            id: update.channel,
            name:
              update.channel.charAt(0).toUpperCase() + update.channel.slice(1),
            platforms: new Set(),
            environments: new Set(),
            created_at: update.created_at,
            device_count: 0,
          };
        }
        channelMap[update.channel].platforms.add(update.platform);
        channelMap[update.channel].environments.add(update.environment);
      });

      Object.entries(channelCounts).forEach(([channel, count]) => {
        if (channelMap[channel]) {
          channelMap[channel].device_count = count;
        }
      });

      const channels = Object.values(channelMap).map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        platforms: Array.from(channel.platforms),
        environments: Array.from(channel.environments),
        created_at: channel.created_at,
        device_count: channel.device_count,
      }));

      res.json(channels);
    } catch (error) {
      logger.error("Channels fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  }

  /**
   * Get all devices for dashboard
   * GET /api/dashboard/devices
   */
  async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.supabaseService.query("device_channels", {
        select: "*",
        order: { column: "updated_at", ascending: false },
      });

      const processedDevices =
        result.data?.map((device: any) => ({
          id: device.id,
          device_id: device.device_id,
          app_id: device.app_id,
          platform: device.platform,
          channel: device.channel,
          updated_at: device.updated_at,
          last_version: "Unknown", // Would need separate query
        })) || [];

      res.json(processedDevices);
    } catch (error) {
      logger.error("Devices fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  }

  /**
   * Get statistics data for dashboard
   * GET /api/dashboard/stats-data
   */
  async getStatsData(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.supabaseService.query("update_stats", {
        select: "*",
        order: { column: "timestamp", ascending: false },
        limit: 100,
      });

      res.json(result.data || []);
    } catch (error) {
      logger.error("Stats data fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch statistics data" });
    }
  }

  /**
   * Update device channel
   * PUT /api/dashboard/devices/:id/channel
   */
  async updateDeviceChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { channel } = req.body;

      const result = await this.supabaseService.update(
        "device_channels",
        {
          channel,
          updated_at: new Date().toISOString(),
        },
        { id: parseInt(id!) }
      );

      if (result.length === 0) {
        throw new ValidationError("Device not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Device channel update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update device channel" });
      }
    }
  }

  /**
   * Delete a device
   * DELETE /api/dashboard/devices/:id
   */
  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("device_channels", {
        id: parseInt(id!),
      });
      res.status(204).send();
    } catch (error) {
      logger.error("Device deletion failed", { error });
      res.status(500).json({ error: "Failed to delete device" });
    }
  }

  /**
   * Delete a channel and all associated bundles
   * DELETE /api/dashboard/channels/:id
   */
  async deleteChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.supabaseService.delete("updates", { channel: id });
      res.status(204).send();
    } catch (error) {
      logger.error("Channel deletion failed", { error });
      res.status(500).json({ error: "Failed to delete channel" });
    }
  }

  // ============================================================
  // Apps CRUD (NEW)
  // ============================================================

  /**
   * Get all apps
   * GET /api/dashboard/apps
   */
  async getApps(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.supabaseService.query("apps", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });
      res.json(result.data || []);
    } catch (error) {
      logger.error("Apps fetch failed", { error });
      // Return empty array if apps table doesn't exist yet
      res.json([]);
    }
  }

  /**
   * Create a new app
   * POST /api/dashboard/apps
   */
  async createApp(req: Request, res: Response): Promise<void> {
    try {
      const { app_id, name } = req.body;

      if (!app_id) {
        throw new ValidationError("app_id is required");
      }

      const result = await this.supabaseService.insert("apps", [
        {
          app_id,
          name: name || app_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("App creation failed", { error });
      res.status(500).json({ error: "Failed to create app" });
    }
  }

  /**
   * Update an app
   * PUT /api/dashboard/apps/:id
   */
  async updateApp(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update(
        "apps",
        { ...updateData, updated_at: new Date().toISOString() },
        { id }
      );

      if (result.length === 0) {
        throw new ValidationError("App not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("App update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update app" });
      }
    }
  }

  /**
   * Delete an app
   * DELETE /api/dashboard/apps/:id
   */
  async deleteApp(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("apps", { id });
      res.status(204).send();
    } catch (error) {
      logger.error("App deletion failed", { error });
      res.status(500).json({ error: "Failed to delete app" });
    }
  }

  // ============================================================
  // Channels CRUD (Enhanced)
  // ============================================================

  /**
   * Create a new channel
   * POST /api/dashboard/channels
   */
  async createChannel(req: Request, res: Response): Promise<void> {
    try {
      const {
        app_id,
        name,
        public: isPublic,
        allow_device_self_set,
        ios,
        android,
      } = req.body;

      if (!app_id || !name) {
        throw new ValidationError("app_id and name are required");
      }

      const result = await this.supabaseService.insert("channels", [
        {
          app_id,
          name,
          public: isPublic ?? false,
          allow_device_self_set: allow_device_self_set ?? false,
          ios: ios ?? true,
          android: android ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("Channel creation failed", { error });
      res.status(500).json({ error: "Failed to create channel" });
    }
  }

  /**
   * Update a channel
   * PUT /api/dashboard/channels/:id
   */
  async updateChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update(
        "channels",
        { ...updateData, updated_at: new Date().toISOString() },
        { id }
      );

      if (result.length === 0) {
        throw new ValidationError("Channel not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Channel update failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update channel" });
      }
    }
  }

  // ============================================================
  // Update Logs (NEW)
  // ============================================================

  /**
   * Get update logs
   * GET /api/dashboard/update-logs
   * Supports query params: ?app_id=...&device_id=...&limit=100
   */
  async getUpdateLogs(req: Request, res: Response): Promise<void> {
    try {
      const { app_id, device_id, limit = 100 } = req.query;

      const queryOptions: any = {
        select: "*",
        order: { column: "timestamp", ascending: false },
        limit: parseInt(limit as string) || 100,
      };

      if (app_id || device_id) {
        queryOptions.match = {};
        if (app_id) queryOptions.match.app_id = app_id;
        if (device_id) queryOptions.match.device_id = device_id;
      }

      const result = await this.supabaseService.query(
        "update_logs",
        queryOptions
      );
      res.json(result.data || []);
    } catch (error) {
      logger.error("Update logs fetch failed", { error });
      res.json([]);
    }
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware(): any {
    return this.fileService.createMulterUpload().single("bundle");
  }
}

export default new AdminController(fileService, supabaseService);
