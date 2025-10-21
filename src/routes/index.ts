import { Router } from "express";
import updateRoutes from "./updateRoutes";
import statsRoutes from "./statsRoutes";
import channelRoutes from "./channelRoutes";
import adminRoutes from "./adminRoutes";
import healthRoutes from "./healthRoutes";
import { healthController } from "@/controllers";

const router: Router = Router();

router.use("/api", updateRoutes);
router.use("/api", statsRoutes);
router.use("/api", channelRoutes);
router.use("/api", adminRoutes);
router.use("/api", healthRoutes);

router.get("/health", healthController.basicHealthCheck.bind(healthController));

export default router;
