import Joi from "joi";
import { Platform } from "@/types";
import { ValidationError } from "@/types";

// Common validation schemas
export const platformSchema = Joi.string()
  .valid("android", "ios", "web")
  .required();

export const semverSchema = Joi.string()
  .pattern(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
  )
  .required();

export const appIdSchema = Joi.string().required();

export const deviceIdSchema = Joi.string().required();

// Request validation schemas
export const updateRequestSchema = Joi.object({
  platform: platformSchema,
  version: semverSchema,
  channel: Joi.string().default("stable"),
  deviceId: Joi.string().optional(),
  appId: appIdSchema,
});

export const statsRequestSchema = Joi.object({
  bundleId: Joi.string().required(),
  status: Joi.string().required(),
  deviceId: deviceIdSchema,
  appId: appIdSchema,
  platform: platformSchema,
});

export const channelAssignmentSchema = Joi.object({
  channel: Joi.string().required(),
  deviceId: deviceIdSchema,
  appId: appIdSchema,
  platform: platformSchema,
});

export const uploadRequestSchema = Joi.object({
  version: semverSchema,
  platform: platformSchema,
  channel: Joi.string().default("stable"),
  environment: Joi.string().valid("dev", "staging", "prod").default("prod"),
  required: Joi.boolean().default(false),
});

// Validation middleware factory
export function validateRequest(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);

    if (error) {
      throw new ValidationError(
        `Validation error: ${error.details.map((d) => d.message).join(", ")}`
      );
    }

    // Replace req.body with validated data
    req.body = value;
    next();
  };
}

// Query parameter validation
export const validateUpdateParams = (req: any, res: any, next: any) => {
  const { platform, version, appId } = req.body;

  if (!platform || !version || !appId) {
    return res.status(400).json({
      error: "Missing required parameters: platform, version, appId",
    });
  }

  if (!["android", "ios", "web"].includes(platform)) {
    return res.status(400).json({
      error: "Invalid platform. Must be: android, ios, web",
    });
  }

  // Note: semver validation is handled by the schema above
  next();
};
