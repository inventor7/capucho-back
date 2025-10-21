import { Router } from "express";
import { statsController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";

const router: Router = Router();
router.use(rateLimiter);

router.post("/stats", statsController.logStats.bind(statsController));

export default router;
