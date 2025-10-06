import { Router } from "express";
import { channelController } from "@/controllers";
import { validateRequest, channelAssignmentSchema } from "@/utils/validators";
import { rateLimiter } from "@/middleware/security";

/**
 * Router for channel management API endpoints
 *
 * Handles device channel assignment and channel information retrieval
 */
const router: Router = Router();

// Apply rate limiting to all channel routes
router.use(rateLimiter);

/**
 * Assign a channel to a device
 * POST /api/channel_self
 *
 * Body: channel, deviceId, appId, platform
 */
router.post(
  "/channel_self",
  validateRequest(channelAssignmentSchema),
  channelController.assignChannel.bind(channelController)
);

/**
 * Get channel for a device
 * GET /api/channel
 *
 * Query parameters: deviceId, appId, platform
 * Returns: { channel: string }
 */
router.get(
  "/channel",
  channelController.getDeviceChannel.bind(channelController)
);

/**
 * Get all available channels for an app
 * GET /api/channels
 *
 * Query parameters: appId, platform
 * Returns: { channels: string[] }
 */
router.get(
  "/channels",
  channelController.getAvailableChannels.bind(channelController)
);

export default router;
