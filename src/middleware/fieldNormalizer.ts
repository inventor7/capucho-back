import { Request, Response, NextFunction } from "express";
import logger from "@/utils/logger";

/**
 * Field name mappings from Capgo plugin (snake_case) to backend (camelCase)
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Core fields
  app_id: "appId",
  device_id: "deviceId",
  version_name: "version",
  version_build: "versionBuild",

  // Device info
  is_emulator: "isEmulator",
  is_prod: "isProd",
  plugin_version: "pluginVersion",

  // Channel fields
  default_channel: "defaultChannel",

  // Stats fields - accept 'action' as official field
  // 'status' is kept for backwards compatibility
};

/**
 * Reverse mappings for response transformation (camelCase to snake_case)
 */
const REVERSE_MAPPINGS: Record<string, string> = Object.entries(
  FIELD_MAPPINGS
).reduce((acc, [snake, camel]) => {
  acc[camel] = snake;
  return acc;
}, {} as Record<string, string>);

/**
 * Normalizes request body fields from snake_case (Capgo plugin) to camelCase (backend)
 * Also handles both naming conventions for backwards compatibility
 */
export function normalizeRequestFields(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    const normalized: Record<string, any> = { ...req.body };

    // Convert snake_case to camelCase
    for (const [snakeCase, camelCase] of Object.entries(FIELD_MAPPINGS)) {
      if (snakeCase in normalized && !(camelCase in normalized)) {
        normalized[camelCase] = normalized[snakeCase];
      }
    }

    // Also keep original snake_case for compatibility
    for (const [snakeCase, camelCase] of Object.entries(FIELD_MAPPINGS)) {
      if (camelCase in normalized && !(snakeCase in normalized)) {
        normalized[snakeCase] = normalized[camelCase];
      }
    }

    // Special handling for 'action' vs 'status' in stats
    // Capgo uses 'action', our legacy code uses 'status'
    if (normalized.action && !normalized.status) {
      normalized.status = normalized.action;
    }
    if (normalized.status && !normalized.action) {
      normalized.action = normalized.status;
    }

    req.body = normalized;

    logger.debug("Normalized request fields", {
      original: req.body,
      normalized,
    });
  }

  // Also normalize query parameters
  if (req.query && typeof req.query === "object") {
    const normalizedQuery: Record<string, any> = { ...req.query };

    for (const [snakeCase, camelCase] of Object.entries(FIELD_MAPPINGS)) {
      if (snakeCase in normalizedQuery && !(camelCase in normalizedQuery)) {
        normalizedQuery[camelCase] = normalizedQuery[snakeCase];
      }
    }

    (req as any).query = normalizedQuery;
  }

  next();
}

/**
 * Transforms response body from camelCase (backend) to snake_case (Capgo plugin)
 * Use this if you need strict Capgo compatibility in responses
 */
export function transformResponseFields(
  obj: Record<string, any>
): Record<string, any> {
  const transformed: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = REVERSE_MAPPINGS[key] || key;
    transformed[snakeKey] = value;

    // Also keep camelCase for dashboard compatibility
    if (snakeKey !== key) {
      transformed[key] = value;
    }
  }

  return transformed;
}

/**
 * Extracts standardized update request from normalized body
 */
export function extractUpdateRequest(body: Record<string, any>) {
  return {
    appId: body.appId || body.app_id,
    deviceId: body.deviceId || body.device_id,
    version: body.version || body.version_name,
    versionBuild: body.versionBuild || body.version_build,
    platform: body.platform,
    channel: body.channel,
    defaultChannel: body.defaultChannel || body.default_channel,
    isEmulator: body.isEmulator ?? body.is_emulator ?? false,
    isProd: body.isProd ?? body.is_prod ?? true,
    pluginVersion: body.pluginVersion || body.plugin_version,
  };
}

/**
 * Extracts standardized stats request from normalized body
 */
export function extractStatsRequest(body: Record<string, any>) {
  return {
    appId: body.appId || body.app_id,
    deviceId: body.deviceId || body.device_id,
    action: body.action || body.status, // Accept both
    version: body.version || body.version_name,
    versionBuild: body.versionBuild || body.version_build,
    platform: body.platform,
    isEmulator: body.isEmulator ?? body.is_emulator ?? false,
    isProd: body.isProd ?? body.is_prod ?? true,
    // Legacy field - bundleId is not part of official spec
    bundleId: body.bundleId || body.bundle_id,
  };
}

/**
 * Extracts standardized channel request from normalized body
 */
export function extractChannelRequest(body: Record<string, any>) {
  return {
    appId: body.appId || body.app_id,
    deviceId: body.deviceId || body.device_id,
    channel: body.channel,
    version: body.version || body.version_name,
    versionBuild: body.versionBuild || body.version_build,
    platform: body.platform,
    defaultChannel: body.defaultChannel || body.default_channel,
    pluginVersion: body.pluginVersion || body.plugin_version,
    isEmulator: body.isEmulator ?? body.is_emulator ?? false,
    isProd: body.isProd ?? body.is_prod ?? true,
  };
}

export default {
  normalizeRequestFields,
  transformResponseFields,
  extractUpdateRequest,
  extractStatsRequest,
  extractChannelRequest,
};
