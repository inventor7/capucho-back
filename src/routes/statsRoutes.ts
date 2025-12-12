import { Router } from "express";
import { statsController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";

const router: Router = Router();
router.use(rateLimiter);

// Apply field normalization to handle snake_case from Capgo plugin
router.use(normalizeRequestFields);

/**
 * Official Capgo plugin stats endpoint
 * POST /stats - Send analytics and events
 *
 * Accepts both 'action' (official) and 'status' (legacy) fields
 */
router.post("/stats", statsController.logStats.bind(statsController));

export default router;
