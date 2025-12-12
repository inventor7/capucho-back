import { Router } from "express";
import { channelController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";

const router: Router = Router();

router.use(rateLimiter);

// Apply field normalization to all channel routes
router.use(normalizeRequestFields);

/**
 * Official Capgo plugin channel_self endpoint
 * Supports all 4 HTTP methods as per official spec
 */

// GET /channel_self - List available channels for device
router.get(
  "/channel_self",
  channelController.listChannels.bind(channelController)
);

// POST /channel_self - Assign device to a channel
router.post(
  "/channel_self",
  channelController.assignChannel.bind(channelController)
);

// PUT /channel_self - Get current device channel
router.put(
  "/channel_self",
  channelController.getDeviceChannel.bind(channelController)
);

// DELETE /channel_self - Remove device from channel (reset to default)
router.delete(
  "/channel_self",
  channelController.unsetChannel.bind(channelController)
);

/**
 * Legacy/Dashboard endpoints (backwards compatible)
 */
router.get(
  "/channel",
  channelController.getDeviceChannel.bind(channelController)
);
router.get("/channels", channelController.listChannels.bind(channelController));
router.post(
  "/channel",
  channelController.assignChannel.bind(channelController)
);

export default router;
