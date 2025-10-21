import { Router } from "express";
import { channelController } from "@/controllers";
import { validateRequest, channelAssignmentSchema } from "@/utils/validators";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

router.post(
  "/channel_self",
  validateRequest(channelAssignmentSchema),
  channelController.assignChannel.bind(channelController)
);

router.get(
  "/channel",
  channelController.getDeviceChannel.bind(channelController)
);

router.get(
  "/channels",
  channelController.getAvailableChannels.bind(channelController)
);

router.post(
  "/channel",
  validateRequest(channelAssignmentSchema),
  channelController.assignChannel.bind(channelController)
);

export default router;
