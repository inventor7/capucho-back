// Common types for the application

export type Platform = "android" | "ios" | "web";

export type Channel = string; // e.g., 'stable', 'beta', 'alpha'

export type Environment = "dev" | "staging" | "prod";

export interface UpdateRequest {
  platform: Platform;
  version: string;
  channel?: Channel;
  deviceId?: string;
  appId: string;
}

export interface UpdateResponse {
  version?: string;
  url?: string;
  checksum?: string;
  sessionKey?: string;
}

export interface StatsRequest {
  bundleId: string;
  status: string;
  deviceId: string;
  appId: string;
  platform: Platform;
}

export interface ChannelAssignmentRequest {
  channel: Channel;
  deviceId: string;
  appId: string;
  platform: Platform;
}

export interface ChannelResponse {
  channel: Channel;
}

export interface ChannelsResponse {
  channels: Channel[];
}

export interface UploadRequest {
  version: string;
  platform: Platform;
  channel?: Channel;
  environment?: Environment;
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
  id: number;
  platform: Platform;
  version: string;
  download_url: string;
  checksum: string;
  session_key?: string;
  channel: Channel;
  environment: Environment;
  required: boolean;
  active: boolean;
  created_at: string;
  created_by?: string;
}

export interface ChannelData {
  id: string;
  name: string;
  platforms: Platform[];
  environments: Environment[];
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
  id?: number;
  platform: Platform;
  version: string;
  download_url: string;
  checksum: string;
  session_key?: string;
  channel: Channel;
  environment: Environment;
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

export interface QueryOptions {
  select?: string;
  count?: "exact" | "planned" | "estimated";
  match?: Record<string, any>;
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
}

// Service interfaces
export interface IUpdateService {
  checkForUpdate(request: UpdateRequest): Promise<UpdateResponse>;
  getAllUpdates(query: {
    platform: Platform;
    appId: string;
    channel?: Channel;
    environment?: Environment;
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

export interface ISupabaseService {
  query(table: string, options: any): Promise<any>;
  insert(table: string, data: any): Promise<any>;
  update(table: string, data: any, filter: any): Promise<any>;
  delete(table: string, filter: any): Promise<any>;
  getClient(): any; // Supabase client instance
}

export interface IFileService {
  calculateChecksum(buffer: Buffer): string;
  uploadFile(fileName: string, buffer: Buffer): Promise<string>;
  validateFile(file: any): Promise<void>; // Using any for now, will be properly typed with Express types
  createMulterUpload(): any; // Multer upload middleware
}

// Configuration types
export interface AppConfig {
  port: number;
  environment: Environment;
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

// Error types
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

    // Safe call for Node.js environments
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
