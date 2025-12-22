import { Request, Response } from "express";
import { ValidationError, IFileService, ISupabaseService } from "@/types";
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
   * Resolve string App ID (e.g. "com.example.app") to UUID
   */
  private async resolveAppUuid(appIdString: string): Promise<string | null> {
    try {
      const { data: appData, error } = await this.supabaseService
        .getClient()
        .from("apps")
        .select("id")
        .eq("app_id", appIdString)
        .maybeSingle();

      if (error) {
        logger.error("Error resolving app UUID", { appIdString, error });
        return null;
      }

      return appData ? appData.id : null;
    } catch (error) {
      logger.error("Failed to resolve app UUID", { appIdString, error });
      return null;
    }
  }

  /**
   * Upload a new update bundle
   * POST /api/admin/upload
   */
  async uploadBundle(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        version_name,
        platform,
        channel = "stable",
        required = false,
        app_id,
      } = req.body;

      const finalVersion = version_name || version;

      logger.info("Upload bundle request received", {
        version: finalVersion,
        platform,
        channel,
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

      if (!finalVersion || !platform || !semver.valid(finalVersion)) {
        throw new ValidationError(
          "Missing or invalid parameters: version, platform (semver required)"
        );
      }

      if (["android", "ios", "web"].indexOf(platform) === -1) {
        throw new ValidationError(
          "Invalid platform. Must be: android, ios, web"
        );
      }

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = app_id
        ? await this.resolveAppUuid(app_id as string)
        : null;

      if (!appUuid) {
        throw new ValidationError("Valid App ID is required");
      }

      // Security Check: If API key is scoped to a specific app, ensure it matches
      const keyAppId = (req as any).appId;
      if (keyAppId && keyAppId !== appUuid) {
        logger.warn("Security breach attempt: API key app scope mismatch", {
          keyAppId,
          targetAppUuid: appUuid,
          userId: (req as any).user?.id,
        });
        res.status(403).json({
          error: "Forbidden",
          message: "This API key is restricted to another application.",
        });
        return;
      }

      const buffer = req.file!.buffer;
      const checksum = this.fileService.calculateChecksum(buffer);

      const fileName = `bundle-${platform}-${finalVersion}-${Date.now()}${require("path").extname(
        req.file!.originalname
      )}`;
      const downloadUrl = await this.fileService.uploadFile(fileName, buffer);

      const updateRecord: any = {
        app_id: appUuid,
        platform: platform as any,
        version_name: finalVersion,
        channel: channel || "stable",
        external_url: downloadUrl,
        checksum,
        required: required === "true" || required === true,
        active: true,
      };

      const insertedRecord = await this.supabaseService.insert("app_versions", [
        updateRecord,
      ]);

      logger.info("Bundle uploaded successfully", {
        version,
        platform,
        recordId: insertedRecord[0]?.id,
      });

      res.json({
        success: true,
        message: `Version ${finalVersion} uploaded successfully`,
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
   * GET /api/dashboard/stats?app_id=...
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;

      logger.info("Fetching dashboard statistics", {
        app_id,
        ip: req.ip,
      });

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res
            .status(403)
            .json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      // If app_id was provided but not found, return zeroes
      if (app_id && !appUuid) {
        res.json({
          bundles_count: 0,
          devices_count: 0,
          channels_count: 0,
          downloads_count: 0,
        });
        return;
      }

      // 1. Total Bundles (from app_versions)
      let bundlesQuery = this.supabaseService
        .getClient()
        .from("app_versions")
        .select("id", { count: "exact" });
      if (appUuid) bundlesQuery = bundlesQuery.eq("app_id", appUuid);
      const { count: bundlesCount } = await bundlesQuery;

      // 2. Active Devices
      let devicesQuery = this.supabaseService
        .getClient()
        .from("device_channels")
        .select("device_id");
      if (appUuid) devicesQuery = devicesQuery.eq("app_id", appUuid);
      const { data: devicesData } = await devicesQuery;
      const devicesCount = devicesData
        ? new Set(devicesData.map((d: any) => d.device_id)).size
        : 0;

      // 3. Total Downloads
      let downloadsQuery = this.supabaseService
        .getClient()
        .from("update_logs")
        .select("id", { count: "exact" })
        .in("action", ["downloaded", "install"]);
      if (appUuid) downloadsQuery = downloadsQuery.eq("app_id", appUuid);
      const { count: downloadsCount } = await downloadsQuery;

      // 4. Active Channels
      let channelsQuery = this.supabaseService
        .getClient()
        .from("channels")
        .select("id", { count: "exact" });
      if (appUuid) channelsQuery = channelsQuery.eq("app_id", appUuid);
      const { count: channelsCount } = await channelsQuery;

      const stats = {
        bundles_count: bundlesCount || 0,
        devices_count: devicesCount || 0,
        channels_count: channelsCount || 0,
        downloads_count: downloadsCount || 0,
      };

      res.json(stats);
    } catch (error) {
      logger.error("Dashboard stats fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  }

  /**
   * Get all bundles for dashboard
   * GET /api/dashboard/bundles
   */
  async getBundles(req: Request, res: Response): Promise<void> {
    try {
      const { app_id } = req.query;
      const { id } = req.params;

      const identifier = (app_id as string) || id;

      // First resolve the app UUID from bundle identifier if provided
      let appUuid = identifier ? await this.resolveAppUuid(identifier) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res
            .status(403)
            .json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      let query = this.supabaseService
        .getClient()
        .from("app_versions")
        .select("*")
        .order("created_at", { ascending: false });

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data, error } = await query;
      if (error) throw error;

      const bundles =
        (data || []).map((bundle: any) => ({
          id: bundle.id,
          version_name: bundle.version_name,
          download_url: bundle.external_url || bundle.r2_path,
          checksum: bundle.checksum,
          session_key: bundle.session_key,
          channel: bundle.channel || "stable",
          required: bundle.required,
          active: bundle.active,
          created_at: bundle.created_at,
          platform: bundle.platform,
          created_by: bundle.uploaded_by,
        })) || [];

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
      const result = await this.supabaseService.insert("app_versions", [
        bundleData,
      ]);
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

      const result = await this.supabaseService.update(
        "app_versions",
        updateData,
        {
          id: id,
        }
      );

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
      await this.supabaseService.delete("app_versions", { id: id });
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
      const { app_id } = req.query;
      const { id } = req.params;

      const identifier = (app_id as string) || id;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = identifier ? await this.resolveAppUuid(identifier) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res
            .status(403)
            .json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      if (identifier && !appUuid) {
        res.json([]);
        return;
      }

      // 1. Get channels from channels table
      let query = this.supabaseService.getClient().from("channels").select(`
          *,
          app_versions:current_version_id (
            version_name
          )
        `);

      if (appUuid) {
        query = query.eq("app_id", appUuid);
      }

      const { data: channelsData, error: channelsError } = await query;
      if (channelsError) throw channelsError;

      // 2. Get device counts and bundle counts per channel
      const channelIds = (channelsData || []).map((c: any) => c.id);
      const deviceCountsMap: Record<string, number> = {};
      const bundleCountsMap: Record<string, number> = {};

      if (channelIds.length > 0) {
        // Device counts
        const { data: devices } = await this.supabaseService
          .getClient()
          .from("device_channels")
          .select("channel_id")
          .in("channel_id", channelIds);

        (devices || []).forEach((d: any) => {
          deviceCountsMap[d.channel_id] =
            (deviceCountsMap[d.channel_id] || 0) + 1;
        });

        // Bundle counts per channel name
        const channelNames = (channelsData || []).map((c: any) => c.name);
        const { data: bundles } = await this.supabaseService
          .getClient()
          .from("app_versions")
          .select("channel")
          .in("channel", channelNames);

        (bundles || []).forEach((b: any) => {
          const channelName = b.channel || "stable";
          bundleCountsMap[channelName] =
            (bundleCountsMap[channelName] || 0) + 1;
        });
      }

      // 3. Format response for frontend
      const result = (channelsData || []).map((c: any) => {
        return {
          ...c,
          bundle_count: bundleCountsMap[c.name] || 0,
          device_count: deviceCountsMap[c.id] || 0,
          current_version: (c.app_versions as any)?.version_name || "None",
        };
      });

      res.json(result);
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
      const { app_id } = req.query;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res
            .status(403)
            .json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      let query = this.supabaseService
        .getClient()
        .from("device_channels")
        .select(
          `
          *,
          channels:channel_id (
            app_id,
            name
          )
        `
        )
        .order("updated_at", { ascending: false });

      if (appUuid) {
        query = query.eq("channels.app_id", appUuid);
      }

      const { data, error } = await query;
      if (error) throw error;

      const processedDevices =
        (data || []).map((device: any) => ({
          id: device.id,
          device_id: device.device_id,
          app_id: device.channels?.app_id || app_id,
          platform: device.platform,
          channel: device.channels?.name || "stable",
          updated_at: device.updated_at,
          last_version: "Unknown",
        })) || [];

      res.json(processedDevices);
    } catch (error) {
      logger.error("Devices fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  }

  /**
   * Get statistics data for dashboard
   * GET /api/dashboard/stats-data?app_id=...&range=...
   */
  async getStatsData(req: Request, res: Response): Promise<void> {
    try {
      const { app_id, range = "month" } = req.query;

      // Resolve the app UUID from bundle identifier if provided
      let appUuid = app_id ? await this.resolveAppUuid(app_id as string) : null;

      // Security Check: If API key is scoped to a specific app, enforce it
      const keyAppId = (req as any).appId;
      if (keyAppId) {
        if (appUuid && keyAppId !== appUuid) {
          res
            .status(403)
            .json({ error: "Forbidden: API key restricted to another app" });
          return;
        }
        appUuid = keyAppId;
      }

      // If app_id was provided but not found, return empty
      if (app_id && !appUuid) {
        res.json({ downloads: [], active_users: [] });
        return;
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      if (range === "day") startDate.setDate(now.getDate() - 1);
      else if (range === "week") startDate.setDate(now.getDate() - 7);
      else if (range === "year") startDate.setFullYear(now.getFullYear() - 1);
      else startDate.setMonth(now.getMonth() - 1); // Default to month

      // Fetch stats from update_logs as update_stats may be missing
      let query = this.supabaseService
        .getClient()
        .from("update_logs")
        .select("created_at, action, device_id")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (appUuid) query = query.eq("app_id", appUuid);

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate data by date
      const downloadsMap: Record<string, number> = {};
      const usersMap: Record<string, Set<string>> = {};

      (data || []).forEach((stat: any) => {
        const date = new Date(stat.created_at).toISOString().split("T")[0]!;

        if (stat.action === "downloaded" || stat.action === "install") {
          downloadsMap[date] = (downloadsMap[date] || 0) + 1;
        }

        if (!usersMap[date]) usersMap[date] = new Set();
        usersMap[date]!.add(stat.device_id);
      });

      const downloads = Object.entries(downloadsMap).map(([date, count]) => ({
        date,
        count,
      }));

      const active_users = Object.entries(usersMap).map(([date, set]) => ({
        date,
        count: set.size,
      }));

      res.json({ downloads, active_users });
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
      const { app_id } = req.query;

      // Resolve the app UUID if app_id provided
      const appUuid = app_id
        ? await this.resolveAppUuid(app_id as string)
        : null;

      const filter: any = { id };
      if (appUuid) filter.app_id = appUuid;

      await this.supabaseService.delete("channels", filter);
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

  /**
   * Get a single channel by ID
   * GET /api/dashboard/channels/:id
   */
  async getChannel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const { data: channel, error } = await this.supabaseService
        .getClient()
        .from("channels")
        .select(
          `
          *,
          app_versions:current_version_id (
            version_name
          )
        `
        )
        .eq("id", id)
        .single();

      if (error || !channel) {
        throw new ValidationError("Channel not found");
      }

      // Get device count
      const { count: deviceCount } = await this.supabaseService
        .getClient()
        .from("device_channels")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", id);

      const result = {
        ...channel,
        bundle_count: 0, // TODO
        device_count: deviceCount || 0,
        current_version: (channel.app_versions as any)?.version_name || "None",
      };

      res.json(result);
    } catch (error) {
      logger.error("Channel fetch failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch channel" });
      }
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
        is_public,
        allow_device_self_set,
        ios_enabled,
        android_enabled,
      } = req.body;

      if (!app_id || !name) {
        throw new ValidationError("app_id and name are required");
      }

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = await this.resolveAppUuid(app_id as string);

      if (!appUuid) {
        throw new ValidationError("Valid App ID is required");
      }

      const result = await this.supabaseService.insert("channels", [
        {
          app_id: appUuid,
          name,
          is_public: is_public ?? false,
          allow_device_self_set: allow_device_self_set ?? false,
          ios_enabled: ios_enabled ?? true,
          android_enabled: android_enabled ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      res.status(201).json(result[0]);
    } catch (error) {
      logger.error("Channel creation failed", {
        error: error instanceof Error ? error.message : String(error),
        body: req.body,
      });
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
      const { app_id, ...sanitizedData } = updateData;

      // Ensure empty UUID fields are null
      if (sanitizedData.current_version_id === "") {
        sanitizedData.current_version_id = null;
      }

      const result = await this.supabaseService.update(
        "channels",
        { ...sanitizedData, updated_at: new Date().toISOString() },
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

      // Resolve the app UUID from bundle identifier if provided
      const appUuid = app_id
        ? await this.resolveAppUuid(app_id as string)
        : null;

      const queryOptions: any = {
        select: "*",
        order: { column: "created_at", ascending: false },
        limit: parseInt(limit as string) || 100,
      };

      if (appUuid || device_id) {
        queryOptions.match = {};
        if (appUuid) queryOptions.match.app_id = appUuid;
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
