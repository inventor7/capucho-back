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

  checkForUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const request = req.body;
      logger.info("Checking for updates", {
        request,
        params: req.params,
        query: req.query,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const result = await this.updateService.checkForUpdate(request);
      res.json(result);
    } catch (error) {
      logger.error("Error checking for updates", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        request: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };

  getAllUpdates = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query as any;
      logger.info("Getting all updates", {
        query,
        params: req.params,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const result = await this.updateService.getAllUpdates(query);
      res.json(result);
    } catch (error) {
      logger.error("Error getting all updates", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };

  getBuiltinVersion = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({});
    } catch (error) {
      logger.error("Error getting builtin version", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  downloadUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      logger.info("Downloading update", {
        id,
        params: req.params,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.status(404).json({ error: "Update not found" });
    } catch (error) {
      logger.error("Error downloading update", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        id: req.params.id,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };

  logDownloadCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging download completed", {
        stats,
        params: req.params,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      await this.updateService.logStats({
        ...stats,
        status: "downloaded",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging download completed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        stats: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };

  logUpdateApplied = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging update applied", {
        stats,
        params: req.params,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      await this.updateService.logStats({
        ...stats,
        status: "applied",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging update applied", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        stats: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };

  logUpdateFailed = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = req.body;
      logger.info("Logging update failed", {
        stats,
        params: req.params,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      await this.updateService.logStats({
        ...stats,
        status: "failed",
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Error logging update failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        stats: req.body,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

const updateController = new UpdateController(
  updateService,
  supabaseService,
  fileService
);

export default updateController;
