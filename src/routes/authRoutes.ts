import { Router } from "express";
import { authController } from "@/controllers";
import { rateLimiter } from "@/middleware/security";
import { normalizeRequestFields } from "@/middleware/fieldNormalizer";
import { authenticate } from "@/middleware";

const router: Router = Router();

router.use(rateLimiter);
router.use(normalizeRequestFields);

// POST /auth/login
router.post("/login", authController.login.bind(authController));

// POST /auth/register
router.post("/register", authController.register.bind(authController));

// GET /auth/me - Get current user profile with organizations and apps
router.get("/me", authenticate, authController.me.bind(authController));

export default router;
