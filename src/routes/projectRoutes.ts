import { Router } from "express";
import { projectController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();

router.use(rateLimiter);

// GET /api/project/config
router.get("/config", projectController.getConfig.bind(projectController));

export default router;
