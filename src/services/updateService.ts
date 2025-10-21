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

      const updates = await supabaseService.query("updates", {
        select: "version, download_url, checksum, session_key",
        eq: { platform: request.platform },
        gt: { version: request.version },
        match: {
          environment: process.env.ENVIRONMENT || "prod",
          channel: request.channel,
          active: true,
        },
        order: { column: "version", ascending: false },
        limit: 1,
      });

      if (updates && updates.length > 0) {
        const latestUpdate = updates[0];
        logger.info("Update found", {
          version: latestUpdate.version,
          deviceId: request.deviceId,
        });

        if (request.deviceId) {
          await supabaseService.insert("update_logs", [
            {
              device_id: request.deviceId,
              app_id: request.appId,
              current_version: request.version,
              new_version: latestUpdate.version,
              platform: request.platform,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        return {
          version: latestUpdate.version,
          url: latestUpdate.download_url,
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

      return { updates: updates || [] };
    } catch (error) {
      logger.error("Get all updates failed", { query, error });
      throw error;
    }
  }

  async logStats(stats: {
    bundleId: string;
    status: string;
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<void> {
    try {
      await supabaseService.insert("update_stats", [
        {
          bundle_id: stats.bundleId,
          status: stats.status,
          device_id: stats.deviceId,
          app_id: stats.appId,
          platform: stats.platform,
          timestamp: new Date().toISOString(),
        },
      ]);

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

      if (existing && existing.length > 0) {
        await supabaseService.update(
          "device_channels",
          {
            channel: assignment.channel,
            platform: assignment.platform,
            updated_at: new Date().toISOString(),
          },
          { id: existing[0].id }
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
  }): Promise<{ channels: string[] }> {
    try {
      const result = await supabaseService.query("updates", {
        select: "channel",
        match: {
          app_id: query.appId,
          platform: query.platform,
          active: true,
        },
      });

      const channels = [
        ...new Set((result || []).map((item: any) => item.channel)),
      ] as string[];
      return { channels };
    } catch (error) {
      logger.error("Get available channels failed", { query, error });
      throw error;
    }
  }
}

export default new UpdateService();
