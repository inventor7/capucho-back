import {
  IUpdateService,
  UpdateRequest,
  UpdateResponse,
  UpdateRecord,
  StatsRequest,
} from "@/types";
import supabaseService from "./supabaseService";
import logger from "@/utils/logger";

class UpdateService implements IUpdateService {
  /**
   * Resolve string App ID (e.g. "com.example.app") to UUID
   */
  private async resolveAppUuid(appIdString: string): Promise<string | null> {
    try {
      const result = await supabaseService.query("apps", {
        select: "id",
        eq: { app_id: appIdString },
      });
      if (result.data && result.data.length > 0) {
        return result.data[0].id;
      }
      return null;
    } catch (error) {
      logger.error("Failed to resolve app UUID", { appIdString, error });
      return null;
    }
  }

  async checkForUpdate(request: UpdateRequest): Promise<UpdateResponse> {
    try {
      logger.info("Checking for updates", { request });

      const appUuid = await this.resolveAppUuid(request.appId);
      if (!appUuid) {
        logger.warn("App not found for update check", { appId: request.appId });
        return { message: "App not found" };
      }

      // Get channel - plugin sends defaultChannel (camelCase) or default_channel (snake_case)
      // Priority: explicit channel > defaultChannel > default_channel > fallback to "staging"
      const channelToUse =
        request.channel ||
        request.defaultChannel ||
        (request as any).default_channel ||
        "staging";

      // Parse user's native version (version_code from plugin, not version_build)
      const userNativeVersion =
        parseInt(request.versionCode || request.versionBuild || "0") || 0;

      // Normalize version - "builtin" means user has no OTA bundle, treat as 0.0.0
      const currentVersion =
        request.version_name === "builtin"
          ? "0.0.0"
          : request.version_name || "0.0.0";

      logger.info("Normalized request", {
        originalVersion: request.version_name,
        normalizedVersion: currentVersion,
        userNativeVersion,
        channel: channelToUse,
        defaultChannelReceived: request.defaultChannel,
        explicitChannelReceived: request.channel,
        appUuid,
      });

      // 1. Get the channel to find the current version
      const { data: channelData, error: channelError } = await supabaseService
        .getClient()
        .from("channels")
        .select(
          `
          id,
          current_version_id,
          app_versions!current_version_id (
            version_name,
            external_url,
            r2_path,
            checksum,
            session_key,
            min_update_version,
            platform
          )
        `
        )
        .eq("app_id", appUuid)
        .eq("name", channelToUse)
        .single();

      if (channelError || !channelData || !channelData.app_versions) {
        logger.info("No active version for channel", { channel: channelToUse });
        return {};
      }

      const latestUpdate = channelData.app_versions as any;

      // Ensure platform matches if specified
      if (request.platform && latestUpdate.platform !== request.platform) {
        logger.info("Platform mismatch for latest version", {
          expected: request.platform,
          actual: latestUpdate.platform,
        });
        return {};
      }

      // Compare versions - check if latest is actually newer than current
      const isNewer =
        this.compareVersions(latestUpdate.version_name, currentVersion) > 0;

      if (!isNewer) {
        logger.info("No update needed - already on latest version", {
          currentVersion,
          latestAvailable: latestUpdate.version_name,
          channel: channelToUse,
        });
        return { message: "No update available" };
      }

      // Check if user's native version meets the minimum requirement
      // Note: mapping min_update_version (string) to minNativeRequired
      const minNativeRequired =
        parseInt(latestUpdate.min_update_version || "0") || 0;

      if (minNativeRequired > 0 && userNativeVersion < minNativeRequired) {
        logger.info("OTA update requires newer native version", {
          userNativeVersion,
          requiredNativeVersion: minNativeRequired,
          otaVersion: latestUpdate.version_name,
          channel: channelToUse,
        });

        return {
          message: "native_update_required",
          error: `Native version ${minNativeRequired} required. You have ${userNativeVersion}.`,
        };
      }

      logger.info("Update found", {
        version_name: latestUpdate.version_name,
        deviceId: request.deviceId,
        channel: channelToUse,
      });

      if (request.deviceId) {
        // Log the update event
        await supabaseService.insert("update_logs", [
          {
            device_id: request.deviceId,
            app_id: appUuid,
            current_version: request.version_name,
            new_version: latestUpdate.version_name,
            platform: request.platform,
            action: "get",
            created_at: new Date().toISOString(),
          },
        ]);

        // Also register the device in device_channels if it doesn't exist
        const { data: existing } = await supabaseService
          .getClient()
          .from("device_channels")
          .select("id")
          .eq("device_id", request.deviceId)
          .eq("channel_id", channelData.id)
          .maybeSingle();

        if (!existing) {
          await supabaseService.insert("device_channels", [
            {
              device_id: request.deviceId,
              channel_id: channelData.id,
              platform: request.platform,
              updated_at: new Date().toISOString(),
            },
          ]);
        }
      }

      return {
        version_name: latestUpdate.version_name,
        url: await this.generateDownloadUrl(
          latestUpdate.external_url || latestUpdate.r2_path
        ),
        checksum: latestUpdate.checksum,
        sessionKey: latestUpdate.session_key || undefined,
      };

      logger.info("No updates available", {
        request,
        channelUsed: channelToUse,
        platform: request.platform,
      });
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
  }): Promise<{ updates: UpdateRecord[] }> {
    try {
      logger.info("Getting all updates", { query });

      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) {
        return { updates: [] };
      }

      // Query app_versions directly for this app/platform
      // Since app_versions doesn't link to channels directly in new schema,
      // we return all versions for the app if channel is 'stable' or not provided
      const { data, error } = await supabaseService
        .getClient()
        .from("app_versions")
        .select(
          `
          version_name,
          external_url,
          r2_path,
          checksum,
          session_key,
          created_at,
          active,
          required
        `
        )
        .eq("app_id", appUuid)
        .eq("platform", query.platform)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedUpdates: UpdateRecord[] = (data || []).map((v: any) => ({
        version_name: v.version_name,
        download_url: v.external_url || v.r2_path,
        checksum: v.checksum,
        session_key: v.session_key,
        channel: query.channel || "stable",
        required: v.required,
        active: v.active,
        created_at: v.created_at,
        platform: query.platform as any,
      }));

      return { updates: formattedUpdates };
    } catch (error) {
      logger.error("Get all updates failed", { query, error });
      throw error;
    }
  }

  async logStats(stats: StatsRequest): Promise<void> {
    try {
      const appUuid = await this.resolveAppUuid(stats.appId);
      if (!appUuid) {
        logger.warn("Skipping stats log - App not found", {
          appId: stats.appId,
        });
        return;
      }

      // Accept both 'action' (official) and 'status' (legacy)
      const actionOrStatus = stats.action || stats.status || "unknown";

      await supabaseService.insert("update_logs", [
        {
          device_id: stats.deviceId,
          app_id: appUuid,
          new_version: stats.bundleId || stats.version_name || "unknown",
          action: actionOrStatus,
          platform: stats.platform,
          created_at: new Date().toISOString(),
        },
      ]);

      // Also register the device in device_channels if it doesn't exist
      // We need to find a channel to link it to
      const { data: channelData } = await supabaseService
        .getClient()
        .from("channels")
        .select("id")
        .eq("app_id", appUuid)
        .eq("name", "stable")
        .maybeSingle();

      if (channelData) {
        const { data: existing } = await supabaseService
          .getClient()
          .from("device_channels")
          .select("id")
          .eq("device_id", stats.deviceId)
          .eq("channel_id", channelData.id)
          .maybeSingle();

        if (!existing) {
          await supabaseService.insert("device_channels", [
            {
              device_id: stats.deviceId,
              channel_id: channelData.id,
              platform: stats.platform,
              updated_at: new Date().toISOString(),
            },
          ]);
        }
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
      const appUuid = await this.resolveAppUuid(assignment.appId);
      if (!appUuid) {
        throw new Error("App not found");
      }

      // 1. Find the channel UUID by name
      const { data: channelData, error: channelError } = await supabaseService
        .getClient()
        .from("channels")
        .select("id")
        .eq("app_id", appUuid)
        .eq("name", assignment.channel)
        .maybeSingle();

      if (channelError || !channelData) {
        throw new Error(`Channel '${assignment.channel}' not found for app`);
      }

      // 2. Update or insert into device_channels
      const { data: existing } = await supabaseService
        .getClient()
        .from("device_channels")
        .select("id")
        .eq("device_id", assignment.deviceId)
        .eq("channel_id", channelData.id)
        .maybeSingle();

      if (existing) {
        await supabaseService.update(
          "device_channels",
          {
            platform: assignment.platform,
            updated_at: new Date().toISOString(),
          },
          { id: existing.id }
        );
      } else {
        await supabaseService.insert("device_channels", [
          {
            device_id: assignment.deviceId,
            channel_id: channelData.id,
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
      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) return { channel: "stable" };

      const { data, error } = await supabaseService
        .getClient()
        .from("device_channels")
        .select(
          `
          channels!inner (
            name
          )
        `
        )
        .eq("device_id", query.deviceId)
        .eq("channels.app_id", appUuid)
        .maybeSingle();

      if (error || !data) return { channel: "stable" };

      return { channel: (data.channels as any).name };
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
      const appUuid = await this.resolveAppUuid(query.appId);
      if (!appUuid) return { channels: [] };

      const { data, error } = await supabaseService
        .getClient()
        .from("channels")
        .select("id, name, is_public, allow_device_self_set")
        .eq("app_id", appUuid);

      if (error) throw error;

      const channels = (data || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        public: ch.is_public,
        allow_self_set: ch.allow_device_self_set,
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
