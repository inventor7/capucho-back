import { Router } from "express";
import apiKeyController from "@/controllers/apiKeyController";
import { authenticate } from "@/middleware";

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api-keys - Create new API key
router.post("/", apiKeyController.create.bind(apiKeyController));

// GET /api-keys - List user's API keys
router.get("/", apiKeyController.list.bind(apiKeyController));

// DELETE /api-keys/:id - Revoke an API key
router.delete("/:id", apiKeyController.revoke.bind(apiKeyController));

export default router;
