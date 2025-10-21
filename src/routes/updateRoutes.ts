import { Router } from "express";
import { updateController } from "@/controllers";
import { validateUpdateParams } from "@/utils/validators";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

router.post(
  "/update",
  validateUpdateParams,
  updateController.checkForUpdate.bind(updateController)
);

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
