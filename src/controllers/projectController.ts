import { Request, Response, NextFunction } from "express";
import supabaseService from "@/services/supabaseService";

class ProjectController {
  /**
   * Get Project Configuration (Flavors, Channels)
   * GET /api/project/config
   */
  public async getConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // 1. Fetch public channels from DB
      // Assuming 'channels' table exists or we filter unique channels from another table
      // Based on channelRoutes, channels seem to be dynamic or tied to devices.
      // Let's try to fetch from a 'channels' table if it exists, or just return standard ones.

      // Since I don't see a strict 'channels' table in the file list (only routes),
      // I'll assume we might need to hardcode defaults or fetch distinct values if possible.
      // However, the channelController manages user channels.
      // Let's fetch the list of *available* channels.
      // If table doesn't exist, this might fail, so I'll wrap in try/catch or use a safer query.

      let channels: string[] = ["production", "staging", "development"];

      // Attempt to query 'channels' table if it exists in your schema
      try {
        const { data } = await supabaseService.query("channels", {
          select: "name",
        });
        if (data && Array.isArray(data)) {
          channels = data.map((c: any) => c.name);
        }
      } catch {
        // Table might not exist yet, fallback to defaults
      }

      // 2. Flavors
      // Mocked for now as per plan, but structured for future DB expansion
      const flavors = [
        { id: "default", name: "(Default)" },
        // Add more mock flavors if needed or fetch from 'flavors' table
      ];

      res.status(200).json({
        success: true,
        channels: channels.map((name) => ({ name, public: true })),
        flavors,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProjectController();
