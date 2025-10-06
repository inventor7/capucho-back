import { Router } from "express";
import { updateController } from "@/controllers";
import {
  validateRequest,
  updateRequestSchema,
  validateUpdateParams,
} from "@/utils/validators";
import { rateLimiter } from "@/middleware/security";

/**
 * Router for update-related API endpoints
 *
 * Handles update checking, notifications, and update information retrieval
 */
const router: Router = Router();

// Apply rate limiting to all update routes
router.use(rateLimiter);

/**
 * Check for available updates
 * POST /api/update
 *
 * Validates platform, version, and appId parameters
 * Returns update information if available, empty object if not
 */
router.post(
  "/update",
  validateUpdateParams,
  updateController.checkForUpdate.bind(updateController)
);

/**
 * Get all available updates for an app
 * GET /api/updates
 *
 * Query parameters: platform, appId, channel (optional), environment (optional)
 */
router.get(
  "/updates",
  validateUpdateParams,
  updateController.getAllUpdates.bind(updateController)
);

/**
 * Get builtin version information
 * GET /api/builtin
 *
 * Query parameters: platform, appId, version
 */
router.get(
  "/builtin",
  validateUpdateParams,
  updateController.getBuiltinVersion.bind(updateController)
);

/**
 * Log download completion notification
 * POST /api/downloaded
 *
 * Body: bundleId, deviceId, appId, platform, version
 */
router.post(
  "/downloaded",
  updateController.logDownloadCompleted.bind(updateController)
);

/**
 * Log update application notification
 * POST /api/applied
 *
 * Body: bundleId, deviceId, appId, platform, version
 */
router.post(
  "/applied",
  updateController.logUpdateApplied.bind(updateController)
);

/**
 * Log update failure notification
 * POST /api/failed
 *
 * Body: bundleId, deviceId, appId, platform, version, error (optional)
 */
router.post("/failed", updateController.logUpdateFailed.bind(updateController));

export default router;
