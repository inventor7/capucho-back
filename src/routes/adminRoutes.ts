import { Router } from "express";
import { adminController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

router.post(
  "/admin/upload",
  adminController.getUploadMiddleware(),
  adminController.uploadBundle.bind(adminController)
);

router.get(
  "/dashboard/stats",
  adminController.getDashboardStats.bind(adminController)
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

router.get(
  "/dashboard/channels",
  adminController.getChannels.bind(adminController)
);

router.delete(
  "/dashboard/channels/:id",
  adminController.deleteChannel.bind(adminController)
);

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

router.get(
  "/dashboard/stats-data",
  adminController.getStatsData.bind(adminController)
);

export default router;
