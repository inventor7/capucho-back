import { Router } from "express";
import { nativeUpdateController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

router.get(
  "/native-updates/check",
  nativeUpdateController.checkNativeUpdate.bind(nativeUpdateController)
);

router.post(
  "/native-updates/log",
  nativeUpdateController.logNativeUpdate.bind(nativeUpdateController)
);

router.get(
  "/dashboard/native-updates",
  nativeUpdateController.getNativeUpdates.bind(nativeUpdateController)
);

router.put(
  "/dashboard/native-updates/:id",
  nativeUpdateController.updateNativeUpdate.bind(nativeUpdateController)
);

router.delete(
  "/dashboard/native-updates/:id",
  nativeUpdateController.deleteNativeUpdate.bind(nativeUpdateController)
);

export default router;
