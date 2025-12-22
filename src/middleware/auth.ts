import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

/**
 * Authentication middleware that supports both:
 * 1. Supabase JWT tokens (from frontend)
 * 2. API keys (from CLI) - format: cap_xxxx
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Missing token" });
      return;
    }

    // Check if it's an API key (starts with cap_)
    if (token.startsWith("cap_")) {
      const user = await validateApiKey(token);
      if (user) {
        (req as any).user = user;
        (req as any).authType = "api_key";
        if (user.app_id) {
          (req as any).appId = user.app_id;
        }
        return next();
      }
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Otherwise treat as Supabase JWT
    const {
      data: { user },
      error,
    } = await supabaseService.getClient().auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    (req as any).user = user;
    (req as any).authType = "jwt";
    next();
  } catch (error) {
    logger.error("Authentication check failed", { error });
    res
      .status(500)
      .json({ error: "Internal server error during authentication" });
  }
};

/**
 * Validate an API key and return user object
 */
async function validateApiKey(apiKey: string): Promise<any | null> {
  try {
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    // Look up the key
    const { data: keyData, error: keyError } = await supabaseService
      .getAdminClient()
      .from("api_keys")
      .select("id, user_id, app_id")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyData) {
      return null;
    }

    // Get the user
    const { data: userData, error: userError } = await supabaseService
      .getAdminClient()
      .from("users")
      .select("id, email, full_name")
      .eq("id", keyData.user_id)
      .single();

    if (userError || !userData) {
      return null;
    }

    // Update last_used_at (fire and forget)
    supabaseService
      .getAdminClient()
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyData.id)
      .then(() => {});

    return {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      app_id: keyData.app_id, // Pass app scope if present
    };
  } catch (error) {
    logger.error("API key validation failed", { error });
    return null;
  }
}
