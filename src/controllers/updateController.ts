import updateService from "@/services/updateService";
import supabaseService from "@/services/supabaseService";
import { fileService } from "@/services";
import { Request, Response } from "express";
import logger from "@/utils/logger";

class UpdateController {
  constructor(
    private updateService: any,
    private supabaseService: any,
    private fileService: any
  ) {}

  // Check for available updates
  checkForUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const request = req.body;
      logger.info("Checking for updates", { request });

      const result = await this.updateService.checkForUpdate(request);
      res.json(result);
    } catch (error) {
      logger.error("Error checking for updates", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Get all available updates
  getAllUpdates = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as any;
      logger.info("Getting all updates", { query });

      const result = await this.updateService.getAllUpdates(query);
      res.json(result);
    } catch (error) {
      logger.error("Error getting all updates", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Get builtin version (not implemented in service, return empty)
  getBuiltinVersion = async (req: Request, res: Response): Promise<void> => {
    try {
      // Return empty object as per original behavior
      res.json({});
    } catch (error) {
      logger.error("Error getting builtin version", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Download update bundle
  downloadUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      logger.info("Downloading update", { id });

      // This would need to be implemented in the service
      // For now, return not found
      res.status(404).json({ error: "Update not found" });
    } catch (error) {
      logger.error("Error downloading update", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Log download completed
  logDownloadCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging download completed", { stats });

      await this.updateService.logStats({
        ...stats,
        status: "downloaded",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging download completed", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Log update applied
  logUpdateApplied = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging update applied", { stats });

      await this.updateService.logStats({
        ...stats,
        status: "applied",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging update applied", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Log update failed
  logUpdateFailed = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging update failed", { stats });

      await this.updateService.logStats({
        ...stats,
        status: "failed",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging update failed", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

const updateController = new UpdateController(updateService, supabaseService, fileService);

export default updateController;

// Export class for testing
export { UpdateController };
