import {
  IUpdateService,
  UpdateRequest,
  UpdateResponse,
  UpdateRecord,
} from "@/types";
import supabaseService from "./supabaseService";
import logger from "@/utils/logger";

class UpdateService implements IUpdateService {
  async checkForUpdate(request: UpdateRequest): Promise<UpdateResponse> {
    try {
      logger.info("Checking for updates", { request });

      const channelToUse =
        request.channel || request.defaultChannel || "stable";

      // Parse user's native version (version_code from plugin, not version_build)
      const userNativeVersion =
        parseInt(request.versionCode || request.versionBuild || "0") || 0;

      // Normalize version - "builtin" means user has no OTA bundle, treat as 0.0.0
      const currentVersion =
        request.version === "builtin" ? "0.0.0" : request.version || "0.0.0";

      logger.info("Normalized request", {
        originalVersion: request.version,
        normalizedVersion: currentVersion,
        userNativeVersion,
        channel: channelToUse,
      });

      // Get latest active update for this platform/channel
      const updates = await supabaseService.query("updates", {
        select:
          "version, download_url, checksum, session_key, min_native_version",
        eq: { platform: request.platform },
        match: {
          environment: process.env.ENVIRONMENT || "prod",
          channel: channelToUse,
          active: true,
        },
        order: { column: "version", ascending: false },
        limit: 1,
      });

      if (updates && updates.data && updates.data.length > 0) {
        const latestUpdate = updates.data[0];

        // Compare versions - check if latest is actually newer than current
        const isNewer =
          this.compareVersions(latestUpdate.version, currentVersion) > 0;

        if (!isNewer) {
          logger.info("No update needed - already on latest version", {
            currentVersion,
            latestAvailable: latestUpdate.version,
          });
          return { message: "No update available" };
        }

        // Check if user's native version meets the minimum requirement
        const minNativeRequired = latestUpdate.min_native_version || 0;

        if (minNativeRequired > 0 && userNativeVersion < minNativeRequired) {
          logger.info("OTA update requires newer native version", {
            userNativeVersion,
            requiredNativeVersion: minNativeRequired,
            otaVersion: latestUpdate.version,
          });

          // Return message indicating native update needed first
          return {
            message: "native_update_required",
            error: `Native version ${minNativeRequired} required. You have ${userNativeVersion}.`,
          };
        }

        logger.info("Update found", {
          version: latestUpdate.version,
          deviceId: request.deviceId,
        });

        if (request.deviceId) {
          // Log the update event
          await supabaseService.insert("update_logs", [
            {
              device_id: request.deviceId,
              app_id: request.appId,
              current_version: request.version,
              new_version: latestUpdate.version,
              platform: request.platform,
              action: "get",
              timestamp: new Date().toISOString(),
            },
          ]);

          // Also register the device in device_channels if it doesn't exist
          const existing = await supabaseService.query("device_channels", {
            match: {
              app_id: request.appId,
              device_id: request.deviceId,
            },
          });

          if (!existing.data || existing.data.length === 0) {
            await supabaseService.insert("device_channels", [
              {
                app_id: request.appId,
                device_id: request.deviceId,
                channel: channelToUse,
                platform: request.platform,
                updated_at: new Date().toISOString(),
              },
            ]);
          }
        }

        return {
          version: latestUpdate.version,
          url: await this.generateDownloadUrl(latestUpdate.download_url),
          checksum: latestUpdate.checksum,
          sessionKey: latestUpdate.session_key || undefined,
        };
      }

      logger.info("No updates available", { request });
      return {};
    } catch (error) {
      logger.error("Update check failed", { request, error });
      throw error;
    }
  }

  async getAllUpdates(query: {
    platform: string;
    appId: string;
    channel?: string;
    environment?: string;
  }): Promise<{ updates: UpdateRecord[] }> {
    try {
      logger.info("Getting all updates", { query });

      const updates = await supabaseService.query("updates", {
        select:
          "version, download_url, checksum, session_key, channel, environment, required, active, created_at",
        match: {
          platform: query.platform,
          environment: query.environment || process.env.ENVIRONMENT || "prod",
          channel: query.channel || "stable",
          active: true,
        },
        gt: { version: "0.0.0" },
        order: { column: "version", ascending: false },
      });

      return { updates: updates.data || [] };
    } catch (error) {
      logger.error("Get all updates failed", { query, error });
      throw error;
    }
  }

  async logStats(stats: {
    bundleId?: string;
    status?: string;
    action?: string;
    deviceId: string;
    appId: string;
    platform: string;
    version?: string;
  }): Promise<void> {
    try {
      // Accept both 'action' (official) and 'status' (legacy)
      const actionOrStatus = stats.action || stats.status || "unknown";

      await supabaseService.insert("update_stats", [
        {
          bundle_id: stats.bundleId || stats.version || "unknown",
          status: actionOrStatus,
          action: actionOrStatus,
          device_id: stats.deviceId,
          app_id: stats.appId,
          platform: stats.platform,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Also register the device in device_channels if it doesn't exist
      // This ensures the device appears in the dashboard
      const existing = await supabaseService.query("device_channels", {
        match: {
          app_id: stats.appId,
          device_id: stats.deviceId,
        },
      });

      if (!existing.data || existing.data.length === 0) {
        await supabaseService.insert("device_channels", [
          {
            app_id: stats.appId,
            device_id: stats.deviceId,
            channel: "stable", // Default to stable channel if no specific channel
            platform: stats.platform,
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      logger.info("Stats logged", { stats });
    } catch (error) {
      logger.error("Failed to log stats", { stats, error });
      throw error;
    }
  }

  async assignChannel(assignment: {
    channel: string;
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<void> {
    try {
      const existing = await supabaseService.query("device_channels", {
        match: {
          app_id: assignment.appId,
          device_id: assignment.deviceId,
        },
      });

      if (existing.data && existing.data.length > 0) {
        await supabaseService.update(
          "device_channels",
          {
            channel: assignment.channel,
            platform: assignment.platform,
            updated_at: new Date().toISOString(),
          },
          { id: existing.data[0].id }
        );
      } else {
        await supabaseService.insert("device_channels", [
          {
            app_id: assignment.appId,
            device_id: assignment.deviceId,
            channel: assignment.channel,
            platform: assignment.platform,
            updated_at: new Date().toISOString(),
          },
        ]);
      }

      logger.info("Channel assigned", { assignment });
    } catch (error) {
      logger.error("Channel assignment failed", { assignment, error });
      throw error;
    }
  }

  async getDeviceChannel(query: {
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<{ channel: string }> {
    try {
      const result = await supabaseService.query("device_channels", {
        select: "channel",
        match: {
          app_id: query.appId,
          device_id: query.deviceId,
          platform: query.platform,
        },
      });

      const channel =
        result && result.length > 0 ? result[0].channel : "stable";
      return { channel };
    } catch (error) {
      logger.error("Get device channel failed", { query, error });
      throw error;
    }
  }

  async getAvailableChannels(query: {
    appId: string;
    platform: string;
  }): Promise<{
    channels: {
      id: string;
      name: string;
      public?: boolean;
      allow_self_set?: boolean;
    }[];
  }> {
    try {
      const result = await supabaseService.query("updates", {
        select: "channel",
        match: {
          app_id: query.appId,
          platform: query.platform,
          active: true,
        },
      });

      // Get unique channels and format as ChannelInfo
      const uniqueChannels = [
        ...new Set((result.data || []).map((item: any) => item.channel)),
      ] as string[];

      const channels = uniqueChannels.map((ch) => ({
        id: ch,
        name: ch,
        public: true,
        allow_self_set: true,
      }));

      return { channels };
    } catch (error) {
      logger.error("Get available channels failed", { query, error });
      throw error;
    }
  }

  private async generateDownloadUrl(downloadUrl: string): Promise<string> {
    try {
      // Extract file path from the Supabase URL
      // Example URL: https://dubnvfvlaiqzbimgaqvp.supabase.co/storage/v1/object/public/updates/bundle-android-1.1.120-1759588025070.zip
      const url = new URL(downloadUrl);
      // The path format is typically /storage/v1/object/public/{bucketName}/{filePath}
      const pathParts = url.pathname.split("/");
      const publicIndex = pathParts.indexOf("public");
      if (publicIndex !== -1 && publicIndex < pathParts.length - 1) {
        // Generate a signed URL that's valid for 1 hour (3600 seconds)
        //const filePath = pathParts.slice(publicIndex + 2).join("/"); // Skip 'public' and bucket name
        // const signedUrl =  await supabaseService.createSignedUrl(filePath, 3600);

        return downloadUrl; //signedUrl;
      } else {
        logger.warn("Could not extract file path from download URL", {
          downloadUrl,
        });
        // If we can't parse the URL, return the original URL
        return downloadUrl;
      }
    } catch (error) {
      logger.error("Failed to generate signed URL", { downloadUrl, error });
      // If signing fails, return the original URL
      return downloadUrl;
    }
  }

  /**
   * Compare two semantic version strings
   * @returns positive if v1 > v2, negative if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map((p) => parseInt(p) || 0);
    const parts2 = v2.split(".").map((p) => parseInt(p) || 0);

    // Pad arrays to same length
    const maxLen = Math.max(parts1.length, parts2.length);
    while (parts1.length < maxLen) parts1.push(0);
    while (parts2.length < maxLen) parts2.push(0);

    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

export default new UpdateService();
