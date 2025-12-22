import { Request, Response } from "express";
import {
  NativeUpdateRecord,
  NativeUpdateLogRecord,
  ValidationError,
  IFileService,
  ISupabaseService,
} from "@/types";
import config from "@/config";
import fileService from "@/services/fileService";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";
import semver from "semver";
import multer, { FileFilterCallback } from "multer";
import * as fs from "fs";

/**
 * Controller for handling native update operations (APK/IPA files)
 */
class NativeUpdateController {
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
   * Check for available native update
   * GET /api/native-updates/check
   */
  async checkNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { platform, channel = "stable", current_version_code } = req.query;

      if (!platform || current_version_code === undefined) {
        throw new ValidationError(
          "Missing required parameters: platform, current_version_code"
        );
      }

      if (!["android", "ios"].includes(platform as string)) {
        throw new ValidationError("Invalid platform. Must be: android, ios");
      }

      const versionCode = parseInt(current_version_code as string, 10);
      if (isNaN(versionCode)) {
        throw new ValidationError("current_version_code must be a number");
      }

      logger.info("Checking for native update", {
        platform,
        channel,
        current_version_code: versionCode,
      });

      // Query for a newer version
      const result = await this.supabaseService.query<NativeUpdateRecord>(
        "native_updates",
        {
          select: "*",
          eq: {
            platform,
            channel,
            active: true,
          },
          gt: { version_code: versionCode },
          order: { column: "version_code", ascending: false },
          limit: 1,
        }
      );

      if (result.data && result.data.length > 0) {
        logger.info("Native update available", {
          platform,
          newVersion: result.data?.[0]?.version_name,
          newVersionCode: result.data?.[0]?.version_code,
        });

        res.json({
          available: true,
          update: result.data[0],
        });
      } else {
        res.json({
          available: false,
          update: null,
        });
      }
    } catch (error) {
      logger.error("Native update check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to check for native update" });
      }
    }
  }

  /**
   * Log native update event
   * POST /api/native-updates/log
   */
  async logNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const {
        event,
        platform,
        device_id,
        current_version_code,
        new_version,
        new_version_code,
        channel,
        error_message,
      } = req.body;

      if (!event || !platform) {
        throw new ValidationError(
          "Missing required parameters: event, platform"
        );
      }

      const logRecord: NativeUpdateLogRecord = {
        event,
        platform,
        device_id,
        current_version_code,
        new_version,
        new_version_code,
        channel,
        error_message,
      };

      await this.supabaseService.insert("native_update_logs", [logRecord]);

      // Also register the device in device_channels if it doesn't exist
      // This ensures the device appears in the dashboard
      if (device_id && req.body.appId && logRecord.platform) {
        const existing = await this.supabaseService.query("device_channels", {
          match: {
            app_id: req.body.appId,
            device_id: device_id,
          },
        });

        if (!existing.data || existing.data.length === 0) {
          await this.supabaseService.insert("device_channels", [
            {
              app_id: req.body.appId,
              device_id: device_id,
              channel: logRecord.channel || "stable",
              platform: logRecord.platform,
              updated_at: new Date().toISOString(),
            },
          ]);
        }
      }

      logger.info("Native update event logged", { event, platform, device_id });

      res.json({ success: true });
    } catch (error) {
      logger.error("Native update log failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to log native update event" });
      }
    }
  }

  /**
   * Upload a new native update (APK/IPA)
   * POST /api/admin/native-upload
   */
  async uploadNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const {
        version,
        version_name, // Added version_name
        version_code,
        platform,
        channel = "stable",
        required = false,
        release_notes,
        app_id,
      } = req.body;

      // Prioritize version_name if provided, otherwise use version
      const finalVersion = version_name || version;

      logger.info("Native upload request received", {
        version: finalVersion, // Use finalVersion for logging
        version_code,
        platform,
        channel,
        required,
        file: req.file
          ? {
              originalName: req.file.originalname,
              size: req.file.size,
              mimetype: req.file.mimetype,
            }
          : null,
      });

      // Validate file
      if (!req.file) {
        throw new ValidationError("No file uploaded");
      }

      // Validate required fields
      if (!finalVersion || !version_code || !platform) {
        throw new ValidationError(
          "Missing required parameters: version, version_code, platform"
        );
      }

      if (!semver.valid(finalVersion)) {
        throw new ValidationError(
          "Version must follow semantic versioning (e.g. 1.2.3)"
        );
      }

      if (!["android", "ios"].includes(platform)) {
        throw new ValidationError("Invalid platform. Must be: android, ios");
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

      const versionCodeNum = parseInt(version_code, 10);
      if (isNaN(versionCodeNum) || versionCodeNum < 1) {
        throw new ValidationError("version_code must be a positive integer");
      }

      // Validate file extension
      const ext = req.file.originalname.toLowerCase().split(".").pop();
      if (platform === "android" && ext !== "apk") {
        throw new ValidationError("Android platform requires an APK file");
      }
      if (platform === "ios" && ext !== "ipa") {
        throw new ValidationError("iOS platform requires an IPA file");
      }

      // Calculate checksum
      const buffer = req.file.buffer || fs.readFileSync(req.file.path);
      const checksum = this.fileService.calculateChecksum(buffer);

      // Upload file with native prefix
      const fileName = `native/${platform}/${channel}/v${versionCodeNum}-${finalVersion}.${ext}`;
      const downloadUrl = await this.supabaseService
        .getClient()
        .storage.from(config.supabase.bucketName)
        .upload(fileName, buffer, {
          contentType:
            platform === "android"
              ? "application/vnd.android.package-archive"
              : "application/octet-stream",
          upsert: false,
        })
        .then(async ({ error }: { error: Error | null }) => {
          if (error) throw error;
          const { data: urlData } = this.supabaseService
            .getClient()
            .storage.from(config.supabase.bucketName)
            .getPublicUrl(fileName);
          return urlData.publicUrl;
        });

      // Create database record
      const updateRecord: Omit<NativeUpdateRecord, "id"> = {
        app_id: appUuid,
        platform: platform as "android" | "ios",
        version_name: finalVersion,
        version_code: versionCodeNum,
        download_url: downloadUrl,
        checksum,
        channel,
        required: required === "true" || required === true,
        active: true,
        file_size_bytes: req.file.size,
        release_notes: release_notes || null,
      };

      const insertedRecord = await this.supabaseService.insert(
        "native_updates",
        [updateRecord]
      );

      logger.info("Native update uploaded successfully", {
        version_name: finalVersion,
        version_code: versionCodeNum,
        platform,
        fileName,
        downloadUrl,
        recordId: insertedRecord[0]?.id,
      });

      res.json({
        success: true,
        message: `Native update v${finalVersion} (code: ${versionCodeNum}) uploaded successfully`,
        downloadUrl,
        fileName,
        record: insertedRecord[0],
      });
    } catch (error) {
      logger.error("Native upload failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
   * Get all native updates for dashboard
   * GET /api/dashboard/native-updates
   */
  async getNativeUpdates(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.supabaseService.query<NativeUpdateRecord>(
        "native_updates",
        {
          select: "*",
          order: { column: "created_at", ascending: false },
        }
      );

      res.json(result.data || []);
    } catch (error) {
      logger.error("Native updates fetch failed", { error });
      res.status(500).json({ error: "Failed to fetch native updates" });
    }
  }

  /**
   * Update a native update record
   * PUT /api/dashboard/native-updates/:id
   */
  async updateNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await this.supabaseService.update(
        "native_updates",
        updateData,
        { id }
      );

      if (result.length === 0) {
        throw new ValidationError("Native update not found");
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Native update modification failed", { error });
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update native update" });
      }
    }
  }

  /**
   * Delete a native update
   * DELETE /api/dashboard/native-updates/:id
   */
  async deleteNativeUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.supabaseService.delete("native_updates", {
        id,
      });
      res.status(204).send();
    } catch (error) {
      logger.error("Native update deletion failed", { error });
      res.status(500).json({ error: "Failed to delete native update" });
    }
  }

  /**
   * Get multer upload middleware for native files
   */
  getUploadMiddleware(): any {
    const storage = multer.memoryStorage();
    const upload = multer({
      storage,
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB limit for native files
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          "application/vnd.android.package-archive", // APK
          "application/octet-stream", // IPA (often served as this)
          "application/x-ios-app", // IPA alternative
        ];
        const allowedExts = [".apk", ".ipa"];
        const ext = file.originalname
          .toLowerCase()
          .slice(file.originalname.lastIndexOf("."));

        if (allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error("Only APK and IPA files are allowed"));
        }
      },
    });
    return upload.single("file");
  }
}

export default new NativeUpdateController(fileService, supabaseService);
