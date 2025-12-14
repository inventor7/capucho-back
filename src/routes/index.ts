import { Router } from "express";
import updateRoutes from "./updateRoutes";
import statsRoutes from "./statsRoutes";
import channelRoutes from "./channelRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import nativeUpdateRoutes from "./nativeUpdateRoutes";
import authRoutes from "./authRoutes";
import projectRoutes from "./projectRoutes";
import { healthController } from "@/controllers";

const router: Router = Router();

router.use("/", updateRoutes);
router.use("/", statsRoutes);
router.use("/", channelRoutes);
router.use("/", adminRoutes);
router.use("/", healthRoutes);
router.use("/", nativeUpdateRoutes);

router.use("/api/auth", authRoutes);
router.use("/api/project", projectRoutes);

router.get("/health", healthController.basicHealthCheck.bind(healthController));

export default router;
