import { Router } from "express";
import { updateController } from "@/controllers";
import { validateUpdateParams } from "@/utils/validators";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";

const router: Router = Router();

router.use(rateLimiter);

// Apply field normalization to handle snake_case from Capgo plugin
router.use(normalizeRequestFields);

/**
 * Official Capgo plugin update endpoint
 * POST /update - Check for available updates
 *
 * Note: Endpoint name doesn't matter as long as it matches
 * the updateUrl in capacitor.config.json
 */
router.post(
  "/update",
  validateUpdateParams,
  updateController.checkForUpdate.bind(updateController)
);

/**
 * Additional update endpoints for dashboard/debugging
 */
router.get(
  "/updates",
  validateUpdateParams,
  updateController.getAllUpdates.bind(updateController)
);

router.get(
  "/builtin",
  validateUpdateParams,
  updateController.getBuiltinVersion.bind(updateController)
);

/**
 * Update lifecycle tracking endpoints
 */
router.post(
  "/downloaded",
  updateController.logDownloadCompleted.bind(updateController)
);

router.post(
  "/applied",
  updateController.logUpdateApplied.bind(updateController)
);

router.post("/failed", updateController.logUpdateFailed.bind(updateController));

export default router;
