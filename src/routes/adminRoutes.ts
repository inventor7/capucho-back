import { Router } from "express";
import { adminController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

/**
 * Router for admin operations API endpoints
 *
 * Handles bundle uploads, dashboard data retrieval, and CRUD operations for bundles, channels, and devices
 */
const router: Router = Router();

// Apply rate limiting to all admin routes
router.use(rateLimiter);

/**
 * Upload a new update bundle
 * POST /api/admin/upload
 *
 * Multipart form data: bundle (file), version, platform, channel, environment, required
 */
router.post(
  "/admin/upload",
  adminController.getUploadMiddleware(),
  adminController.uploadBundle.bind(adminController)
);

/**
 * Get dashboard statistics
 * GET /api/dashboard/stats
 *
 * Returns counts for bundles, devices, channels, and downloads
 */
router.get(
  "/dashboard/stats",
  adminController.getDashboardStats.bind(adminController)
);

/**
 * Get all bundles for dashboard
 * GET /api/dashboard/bundles
 */
router.get(
  "/dashboard/bundles",
  adminController.getBundles.bind(adminController)
);

/**
 * Create a new bundle
 * POST /api/dashboard/bundles
 */
router.post(
  "/dashboard/bundles",
  adminController.createBundle.bind(adminController)
);

/**
 * Update a bundle
 * PUT /api/dashboard/bundles/:id
 */
router.put(
  "/dashboard/bundles/:id",
  adminController.updateBundle.bind(adminController)
);

/**
 * Delete a bundle
 * DELETE /api/dashboard/bundles/:id
 */
router.delete(
  "/dashboard/bundles/:id",
  adminController.deleteBundle.bind(adminController)
);

/**
 * Get all channels for dashboard
 * GET /api/dashboard/channels
 */
router.get(
  "/dashboard/channels",
  adminController.getChannels.bind(adminController)
);

/**
 * Delete a channel and all associated bundles
 * DELETE /api/dashboard/channels/:id
 */
router.delete(
  "/dashboard/channels/:id",
  adminController.deleteChannel.bind(adminController)
);

/**
 * Get all devices for dashboard
 * GET /api/dashboard/devices
 */
router.get(
  "/dashboard/devices",
  adminController.getDevices.bind(adminController)
);

/**
 * Update device channel
 * PUT /api/dashboard/devices/:id/channel
 */
router.put(
  "/dashboard/devices/:id/channel",
  adminController.updateDeviceChannel.bind(adminController)
);

/**
 * Delete a device
 * DELETE /api/dashboard/devices/:id
 */
router.delete(
  "/dashboard/devices/:id",
  adminController.deleteDevice.bind(adminController)
);

/**
 * Get statistics data for dashboard
 * GET /api/dashboard/stats-data
 */
router.get(
  "/dashboard/stats-data",
  adminController.getStatsData.bind(adminController)
);

export default router;
