import { SupabaseClient } from "@supabase/supabase-js";
export * from "./models";

export type Platform = "android" | "ios" | "web";

export type Channel = string; // e.g., 'stable', 'beta', 'alpha'

export interface UpdateRequest {
  platform: Platform;
  version_name: string;
  channel?: Channel;
  deviceId?: string;
  appId: string;
  defaultChannel?: Channel;
  // Additional fields from official Capgo spec
  versionBuild?: string; // App version string (e.g., "1.0.0")
  versionCode?: string; // Native build number (e.g., "54")
  isEmulator?: boolean;
  isProd?: boolean;
  pluginVersion?: string;
}

/**
 * Official Capgo update response format
 */
export interface UpdateResponse {
  version_name?: string;
  url?: string;
  checksum?: string;
  sessionKey?: string;
  /** Manifest for multi-file downloads */
  manifest?: ManifestEntry[];
  /** Error message if update check failed */
  error?: string;
  /** Message for client */
  message?: string;
}

/**
 * Manifest entry for multi-file bundle downloads
 */
export interface ManifestEntry {
  file_name: string;
  file_hash: string;
  /** File download URL (optional if included in bundle) */
  download_url?: string;
}

/**
 * Official Capgo stats request format
 * Note: Plugin sends 'action', legacy code uses 'status' - both are supported
 */
export interface StatsRequest {
  /** Action type (official Capgo field) */
  action?: string;
  /** Status (legacy field, same as action) */
  status?: string;
  /** Bundle ID (optional, not always sent by plugin) */
  bundleId?: string;
  deviceId: string;
  appId: string;
  platform: Platform;
  /** Version info */
  version?: string;
  version_name?: string;
  versionBuild?: string;
  /** Device state */
  isEmulator?: boolean;
  isProd?: boolean;
  /** Old version for upgrade tracking */
  oldVersionName?: string;
}

export interface ChannelAssignmentRequest {
  channel: Channel;
  deviceId: string;
  appId: string;
  platform: Platform;
  version?: string;
  version_name?: string;
  versionBuild?: string;
  pluginVersion?: string;
  isEmulator?: boolean;
  isProd?: boolean;
}

/**
 * Official Capgo channel response format
 */
export interface ChannelResponse {
  channel: Channel;
  /** Status: "default" or "override" */
  status?: "default" | "override";
  /** Whether device can self-assign to channels */
  allowSet?: boolean;
}

/**
 * Channels list response
 */
export interface ChannelsResponse {
  channels: ChannelInfo[];
}

/**
 * Channel info in list response
 */
export interface ChannelInfo {
  id: string;
  name: string;
  public?: boolean;
  allow_self_set?: boolean;
}

export interface UploadRequest {
  version_name: string;
  platform: Platform;
  channel?: Channel;
  required?: boolean;
}

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  message?: string;
  timestamp: string;
  supabase?: "connected";
  storage?: "configured";
  error?: string;
}

// Dashboard API types
export interface DashboardStatsResponse {
  totalBundles: number;
  activeDevices: number;
  activeChannels: number;
  totalDownloads: number;
}

export interface BundleData {
  id: string;
  platform: Platform;
  version_name: string;
  download_url: string;
  checksum: string;
  session_key?: string;
  channel: Channel;
  required: boolean;
  active: boolean;
  created_at: string;
  created_by?: string;
}

export interface ChannelData {
  id: string;
  name: string;
  platforms: Platform[];
  created_at: string;
  device_count: number;
}

export interface DeviceData {
  id: number;
  device_id: string;
  app_id: string;
  platform: Platform;
  channel: Channel;
  updated_at: string;
  last_version?: string;
}

// Database record types
export interface UpdateRecord {
  id?: string;
  platform: Platform;
  version_name: string;
  download_url: string;
  checksum: string;
  session_key?: string;
  channel: Channel;
  required: boolean;
  active: boolean;
  created_at?: string;
  created_by?: string;
}

export interface DeviceChannelRecord {
  id?: number;
  app_id: string;
  device_id: string;
  channel: Channel;
  platform: Platform;
  updated_at?: string;
}

export interface UpdateStatsRecord {
  id?: number;
  bundle_id: string;
  status: string;
  device_id: string;
  app_id: string;
  platform: Platform;
  timestamp?: string;
  details?: string;
}

// Native update types (for APK/IPA files)
export type NativePlatform = "android" | "ios";

export interface NativeUpdateRecord {
  id?: string;
  app_id: string; // uuid
  platform: NativePlatform;
  version_name: string;
  version_code: number;
  download_url: string;
  checksum?: string;
  channel: string;
  required: boolean;
  active: boolean;
  file_size_bytes?: number;
  release_notes?: string;
  created_at?: string;
}

export interface NativeUpdateCheckRequest {
  platform: NativePlatform;
  channel?: string;
  current_version_code: number;
}

export interface NativeUpdateCheckResponse {
  available: boolean;
  update: NativeUpdateRecord | null;
}

export interface NativeUpdateLogRecord {
  id?: string;
  event: string;
  platform: string;
  device_id?: string;
  current_version_code?: number;
  new_version?: string;
  new_version_code?: number;
  channel?: string;
  error_message?: string;
  created_at?: string;
}

export interface QueryOptions {
  select?: string;
  count?: "exact" | "planned" | "estimated";
  match?: Record<string, any>;
  eq?: Record<string, any>;
  gt?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface QueryResult<T = any> {
  data: T[] | null;
  count?: number | null;
}
export interface ISupabaseService {
  query<T = any>(
    table: string,
    options?: QueryOptions
  ): Promise<QueryResult<T>>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, data: any, filter: any): Promise<any>;
  delete(table: string, filter: any): Promise<any>;
  createSignedUrl(filePath: string, expiresIn: number): Promise<string>;
  getClient(): SupabaseClient;
}

// Service interfaces
export interface IUpdateService {
  checkForUpdate(request: UpdateRequest): Promise<UpdateResponse>;
  getAllUpdates(query: {
    platform: Platform;
    appId: string;
    channel?: Channel;
  }): Promise<{ updates: UpdateRecord[] }>;
  logStats(stats: StatsRequest): Promise<void>;
  assignChannel(assignment: ChannelAssignmentRequest): Promise<void>;
  getDeviceChannel(query: {
    deviceId: string;
    appId: string;
    platform: string;
  }): Promise<ChannelResponse>;
  getAvailableChannels(query: {
    appId: string;
    platform: string;
  }): Promise<ChannelsResponse>;
}

export interface IFileService {
  calculateChecksum(buffer: Buffer): string;
  uploadFile(fileName: string, buffer: Buffer): Promise<string>;
  validateFile(file: any): Promise<void>; // Using any for now, will be properly typed with Express types
  createMulterUpload(): any; // Multer upload middleware
}

export interface AppConfig {
  port: number;
  supabase: {
    url: string;
    key: string;
    serviceKey?: string;
    bucketName: string;
  };
  security: {
    rateLimit: {
      windowMs: number;
      max: number;
    };
    cors: {
      origin: string | string[];
      credentials: boolean;
    };
  };
  upload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
  };
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(`Database error: ${message}`, 500);
  }
}
