import { Router } from "express";
import { authController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";

const router: Router = Router();

router.use(rateLimiter);
router.use(normalizeRequestFields);

// POST /api/auth/login
router.post("/login", authController.login.bind(authController));

// POST /api/auth/register
router.post("/register", authController.register.bind(authController));

export default router;
