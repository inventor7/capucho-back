import { Router } from "express";
import { statsController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

/**
 * Router for statistics logging API endpoints
 *
 * Handles logging of update statistics and analytics data
 */
const router: Router = Router();

// Apply rate limiting to all stats routes
router.use(rateLimiter);

/**
 * Log update statistics
 * POST /api/stats
 *
 * Body: bundleId, status, deviceId, appId, platform
 * Logs update events like downloads, installations, failures
 */
router.post("/stats", statsController.logStats.bind(statsController));

export default router;
