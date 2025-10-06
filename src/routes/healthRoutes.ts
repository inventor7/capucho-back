import { Router } from "express";
import { healthController } from "@/controllers";

/**
 * Router for health check API endpoints
 *
 * Provides health monitoring and status information for the service
 */
const router: Router = Router();

/**
 * Health check for the update service
 * GET /api/health
 *
 * Tests database connectivity and returns service health status
 */
router.get("/health", healthController.healthCheck.bind(healthController));

export default router;
