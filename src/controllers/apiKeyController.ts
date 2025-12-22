import { Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "crypto";
import supabaseService from "@/services/supabaseService";
import { AppError } from "@/types";

class ApiKeyController {
  /**
   * Generate a new API key
   * POST /api/api-keys
   */
  public async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      // Optional: scope to specific app
      const { name = "CLI Key", app_id } = req.body;

      // Generate a random key: cap_<32 random hex chars>
      const randomPart = randomBytes(16).toString("hex");
      const plainKey = `cap_${randomPart}`;

      // Hash the key for storage
      const keyHash = createHash("sha256").update(plainKey).digest("hex");

      // Store first 12 chars as prefix for display
      const keyPrefix = plainKey.substring(0, 12);

      // Insert into database
      const { data, error } = await supabaseService
        .getAdminClient()
        .from("api_keys")
        .insert({
          user_id: user.id,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          app_id: app_id || null, // Optional app scope
        })
        .select()
        .single();

      if (error) {
        throw new AppError(error.message, 500);
      }

      // Return the plain key ONLY ONCE
      res.status(201).json({
        success: true,
        message: "API key created. Copy it now - you won't see it again!",
        key: plainKey,
        id: data.id,
        name: data.name,
        prefix: keyPrefix,
        app_id: data.app_id,
        created_at: data.created_at,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List user's API keys (without the actual keys)
   * GET /api/api-keys
   */
  public async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      const { app_id } = req.query;

      let query = supabaseService
        .getAdminClient()
        .from("api_keys")
        .select("id, name, key_prefix, app_id, last_used_at, created_at")
        .eq("user_id", user.id);

      if (app_id) {
        query = query.eq("app_id", app_id);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        throw new AppError(error.message, 500);
      }

      res.json({
        success: true,
        keys: data || [],
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke an API key
   * DELETE /api/api-keys/:id
   */
  public async revoke(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      const { id } = req.params;

      const { error } = await supabaseService
        .getAdminClient()
        .from("api_keys")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new AppError(error.message, 500);
      }

      res.json({
        success: true,
        message: "API key revoked",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate an API key and return user info + app scope
   * Used internally by auth middleware
   */
  public async validateKey(
    apiKey: string
  ): Promise<{ userId: string; appId?: string } | null> {
    try {
      const keyHash = createHash("sha256").update(apiKey).digest("hex");

      const { data, error } = await supabaseService
        .getClient()
        .from("api_keys")
        .select("id, user_id, app_id")
        .eq("key_hash", keyHash)
        .single();

      if (error || !data) {
        return null;
      }

      // Update last_used_at
      await supabaseService
        .getAdminClient()
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);

      return { userId: data.user_id, appId: data.app_id };
    } catch {
      return null;
    }
  }
}

export default new ApiKeyController();
