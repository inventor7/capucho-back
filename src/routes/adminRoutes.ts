import { Router } from "express";
import { adminController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

// ============================================================
// Bundle Management
// ============================================================

router.post(
  "/admin/upload",
  adminController.getUploadMiddleware(),
  adminController.uploadBundle.bind(adminController)
);

router.get(
  "/dashboard/bundles",
  adminController.getBundles.bind(adminController)
);

router.post(
  "/dashboard/bundles",
  adminController.createBundle.bind(adminController)
);

router.put(
  "/dashboard/bundles/:id",
  adminController.updateBundle.bind(adminController)
);

router.delete(
  "/dashboard/bundles/:id",
  adminController.deleteBundle.bind(adminController)
);

// ============================================================
// Apps Management (NEW - for multi-app support)
// ============================================================

router.get("/dashboard/apps", adminController.getApps.bind(adminController));

router.post("/dashboard/apps", adminController.createApp.bind(adminController));

router.put(
  "/dashboard/apps/:id",
  adminController.updateApp.bind(adminController)
);

router.delete(
  "/dashboard/apps/:id",
  adminController.deleteApp.bind(adminController)
);

// ============================================================
// Channel Management
// ============================================================

router.get(
  "/dashboard/channels",
  adminController.getChannels.bind(adminController)
);

router.post(
  "/dashboard/channels",
  adminController.createChannel.bind(adminController)
);

router.put(
  "/dashboard/channels/:id",
  adminController.updateChannel.bind(adminController)
);

router.delete(
  "/dashboard/channels/:id",
  adminController.deleteChannel.bind(adminController)
);

// ============================================================
// Device Management
// ============================================================

router.get(
  "/dashboard/devices",
  adminController.getDevices.bind(adminController)
);

router.put(
  "/dashboard/devices/:id/channel",
  adminController.updateDeviceChannel.bind(adminController)
);

router.delete(
  "/dashboard/devices/:id",
  adminController.deleteDevice.bind(adminController)
);

// ============================================================
// Statistics & Logs
// ============================================================

router.get(
  "/dashboard/stats",
  adminController.getDashboardStats.bind(adminController)
);

router.get(
  "/dashboard/stats-data",
  adminController.getStatsData.bind(adminController)
);

router.get(
  "/dashboard/update-logs",
  adminController.getUpdateLogs.bind(adminController)
);

export default router;
