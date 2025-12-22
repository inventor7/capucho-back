import { Router } from "express";
import { appController, adminController } from "@/controllers";
import {
  authenticate,
  checkAppAccess,
  requireAppAdmin,
  requireOrgAdmin,
} from "@/middleware";

const router: Router = Router();

// All app routes require authentication
router.use(authenticate);

// List apps (controller handles filtering by user's permissions)
router.get("/", appController.list.bind(appController));

// Create app (must be admin of the organization)
// organization_id comes from body
router.post(
  "/",
  requireOrgAdmin("body"),
  appController.create.bind(appController)
);

// Get app details (must have app access)
router.get("/:id", checkAppAccess(), appController.get.bind(appController));

// Update app (must be app admin)
router.put("/:id", requireAppAdmin(), appController.update.bind(appController));

// Delete app (must be app admin)
router.delete(
  "/:id",
  requireAppAdmin(),
  appController.delete.bind(appController)
);

// App Permissions
router.get(
  "/:id/permissions",
  checkAppAccess(),
  appController.getPermissions.bind(appController)
);

router.post(
  "/:id/permissions",
  requireAppAdmin(),
  appController.setPermission.bind(appController)
);

router.delete(
  "/:id/permissions/:userId",
  requireAppAdmin(),
  appController.removePermission.bind(appController)
);

// App Channels
router.get(
  "/:id/channels",
  checkAppAccess(),
  adminController.getChannels.bind(adminController)
);

// App Releases (Bundles)
router.get(
  "/:id/releases",
  checkAppAccess(),
  adminController.getBundles.bind(adminController)
);

export default router;
