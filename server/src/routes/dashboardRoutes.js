import { Router } from "express";
import { authGuard } from "../middleware/auth.js";
import {
  getBuyerDashboard,
  getFarmerDashboard,
  getAdminDashboard,
  getAnalyticsData,
  getAdminAnalytics
} from "../controllers/dashboardController.js";

const router = Router();

// All routes require authentication
router.use(authGuard);

// Dashboard routes
router.get('/buyer', getBuyerDashboard);
router.get('/farmer', getFarmerDashboard);
router.get('/admin', getAdminDashboard);

// Analytics data for charts
router.get('/analytics', getAnalyticsData);

// Admin analytics data
router.get('/admin/analytics', getAdminAnalytics);

export default router;

