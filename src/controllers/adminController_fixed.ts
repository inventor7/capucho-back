import { Request, Response } from "express";
import {
  UploadRequest,
  BundleData,
  ChannelData,
  DeviceData,
  DashboardStatsResponse,
  UpdateRecord,
  DeviceChannelRecord,
  UpdateStatsRecord,
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

      // Validate file
      await this.fileService.validateFile(req.file);

      // Validate parameters
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

      // Calculate checksum
      const buffer =
        req.file!.buffer || require("fs").readFileSync(req.file!.path);
      const checksum = this.fileService.calculateChecksum(buffer);

      // Upload file to storage
      const fileName = `bundle-${platform}-${version}-${Date.now()}${require("path").extname(
        req.file!.originalname
      )}`;
      const downloadUrl = await this.fileService.uploadFile(fileName, buffer);

      // Insert update record into database
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
      });

      res.json({
        success: true,
        message: `Version ${version} uploaded successfully`,
        downloadUrl,
        fileName,
        record: insertedRecord[0],
      });
    } catch (error) {
      logger.error("Bundle upload failed", { error });
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
      console.log("=== DASHBOARD STATS - START ===");

      // Get total bundles count
      console.log("Step 1: Fetching total bundles count");
      const bundlesResult = await this.supabaseService.query("updates", {
        select: "*",
        count: "exact"
      });
      
      console.log("Bundles result:", bundlesResult);
      const totalBundles = bundlesResult.count || 0;
      console.log("Bundles count:", totalBundles);

      // Get active devices count (unique device_ids)
      console.log("Step 2: Fetching active devices");
      const devicesResult = await this.supabaseService.query("device_channels", {
        select: "device_id"
      });
      
      console.log("Devices result:", devicesResult);
      const activeDevices = devicesResult.data
        ? new Set(devicesResult.data.map((d: any) => d.device_id)).size
        : 0;

      // Get active channels count (unique channels)
      console.log("Step 3: Fetching active channels");
      const channelsResult = await this.supabaseService.query("updates", {
        select: "channel"
      });
      
      console.log("Channels result:", channelsResult);
      const activeChannels = channelsResult.data
        ? new Set(channelsResult.data.map((c: any) => c.channel)).size
        : 0;

      // Get total downloads (downloaded stats)
      console.log("Step 4: Fetching total downloads");
      const downloadsResult = await this.supabaseService.query("update_stats", {
        select: "*",
        count: "exact",
        eq: { status: "downloaded" }
      });
      
      console.log("Downloads result:", downloadsResult);
      const totalDownloads = downloadsResult.count || 0;

      const stats: DashboardStatsResponse = {
        totalBundles,
        activeDevices,
        activeChannels,
        totalDownloads,
      };

      console.log("=== DASHBOARD STATS - SUCCESS ===", stats);
      res.json(stats);
    } catch (error) {
      console.error("=== DASHBOARD STATS - ERROR ===", error);
      logger.error(
        `Dashboard stats fetch failed - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
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
      const bundles = await this.supabaseService.query("updates", {
        select: "*",
        order: { column: "created_at", ascending: false },
      });

      res.json(bundles);
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
      // Get all unique channels with their details
      const updatesData = await this.supabaseService.query("updates", {
        select: "channel, platform, environment, created_at",
      });

      // Get device counts
      const allChannels = await this.supabaseService.query("device_channels", {
        select: "channel",
      });

      const channelCounts: { [key: string]: number } = {};
      allChannels.forEach((item: any) => {
        channelCounts[item.channel] = (channelCounts[item.channel] || 0) + 1;
      });

      // Create channel map
      const channelMap: { [key: string]: any } = {};
      updatesData.forEach((update: any) => {
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

      // Add device counts
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
      const devices = await this.supabaseService.query("device_channels", {
        select: "*",
        order: { column: "updated_at", ascending: false },
      });

      // Process data to match expected format
      const processedDevices = devices.map((device: any) => ({
        id: device.id,
        device_id: device.device_id,
        app_id: device.app_id,
        platform: device.platform,
        channel: device.channel,
        updated_at: device.updated_at,
        last_version: "Unknown", // Would need separate query
      }));

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
      const statsData = await this.supabaseService.query("update_stats", {
        select: "*",
        order: { column: "timestamp", ascending: false },
        limit: 100,
      });

      res.json(statsData);
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

      // Delete all bundles associated with this channel
      await this.supabaseService.delete("updates", { channel: id });
      res.status(204).send();
    } catch (error) {
      logger.error("Channel deletion failed", { error });
      res.status(500).json({ error: "Failed to delete channel" });
    }
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return this.fileService.createMulterUpload().single("bundle");
  }
}

// Export singleton instance
export default new AdminController(fileService, supabaseService);