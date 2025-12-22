import { Router } from "express";
import updateRoutes from "./updateRoutes";
import statsRoutes from "./statsRoutes";
import channelRoutes from "./channelRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import nativeUpdateRoutes from "./nativeUpdateRoutes";
import authRoutes from "./authRoutes";
import projectRoutes from "./projectRoutes";
import organizationRoutes from "./organizationRoutes";
import userRoutes from "./userRoutes";
import appRoutes from "./appRoutes";
import onboardingRoutes from "./onboardingRoutes";
import apiKeyRoutes from "./apiKeyRoutes";
import { healthController } from "@/controllers";

const router: Router = Router();

router.use("/", updateRoutes);
router.use("/", statsRoutes);
router.use("/", channelRoutes);
router.use("/", adminRoutes);
router.use("/", healthRoutes);
router.use("/", nativeUpdateRoutes);

router.use("/organizations", organizationRoutes);
router.use("/users", userRoutes);
router.use("/apps", appRoutes);
router.use("/onboarding", onboardingRoutes);

router.use("/auth", authRoutes);
router.use("/project", projectRoutes);
router.use("/api-keys", apiKeyRoutes);

router.get("/health", healthController.basicHealthCheck.bind(healthController));

export default router;
