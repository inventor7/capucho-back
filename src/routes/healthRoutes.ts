import { Router } from "express";
import { healthController } from "@/controllers";

const router: Router = Router();

router.get("/health", healthController.healthCheck.bind(healthController));

export default router;
