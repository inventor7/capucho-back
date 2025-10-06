import dotenv from "dotenv";
import Joi from "joi";
import { AppConfig, Environment } from "@/types";

// Load environment variables
dotenv.config();

// Environment variables schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3000),
  ENVIRONMENT: Joi.string().valid("dev", "staging", "prod").default("prod"),

  // Supabase configuration
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_KEY: Joi.string().required(),
  SUPABASE_SERVICE_KEY: Joi.string().optional(),
  BUCKET_NAME: Joi.string().default("updates"),

  // Security configuration
  CORS_ORIGIN: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .default("*"),

  // Upload configuration
  MAX_FILE_SIZE: Joi.number().default(100 * 1024 * 1024), // 100MB
}).unknown(true); // Allow unknown environment variables

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(
    `Environment variable validation error: ${error.details
      .map((d) => d.message)
      .join(", ")}`
  );
}

// Configuration object
const config: AppConfig = {
  port: envVars.PORT,
  environment: envVars.ENVIRONMENT as Environment,
  supabase: {
    url: envVars.SUPABASE_URL,
    key: envVars.SUPABASE_KEY,
    serviceKey: envVars.SUPABASE_SERVICE_KEY,
    bucketName: envVars.BUCKET_NAME,
  },
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10000, // limit each IP to 100 requests per windowMs
    },
    cors: {
      origin: envVars.CORS_ORIGIN,
      credentials: false, // Set to true if you need credentials
    },
  },
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedMimeTypes: [
      "application/zip",
      "application/octet-stream",
      "application/x-zip-compressed",
    ],
  },
};

// Validate critical configuration
if (!config.supabase.url || !config.supabase.key) {
  throw new Error("Supabase URL and API key are required");
}

export default config;

// Export individual config sections for convenience
export const { port, environment, supabase, security, upload } = config;
