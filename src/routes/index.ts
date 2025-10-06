import { Router } from "express";
import updateRoutes from "./updateRoutes";
import statsRoutes from "./statsRoutes";
import channelRoutes from "./channelRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import { healthController } from "@/controllers";

/**
 * Main router that combines all API route modules
 *
 * Mounts all route handlers under appropriate API prefixes
 */
const router: Router = Router();

// Mount route modules with API prefixes
router.use("/api", updateRoutes);
router.use("/api", statsRoutes);
router.use("/api", channelRoutes);
router.use("/api", adminRoutes);
router.use("/api", healthRoutes);

// Basic health check at root level
router.get("/health", healthController.basicHealthCheck.bind(healthController));

export default router;
