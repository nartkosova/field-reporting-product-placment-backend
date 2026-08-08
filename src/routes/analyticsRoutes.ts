import express from "express";
import middleware from "../utils/middleware";
import {
  getAnalyticsByEmployee,
  getAnalyticsOverview,
  getAnalyticsPhotoCategories,
  getAnalyticsPhotoTypes,
  getAnalyticsStoreCoverage,
  getAnalyticsTimeseries,
} from "../controllers/analyticsController";

const router = express.Router();

// Every role may read analytics; the service scopes non-admins to their own
// rows, so a viewer or employee never sees another user's numbers.
const readRoles = middleware.authorizeRole(["admin", "employee", "viewer"]);

router.get("/overview", readRoles, getAnalyticsOverview);
router.get("/timeseries", readRoles, getAnalyticsTimeseries);
router.get("/by-employee", readRoles, getAnalyticsByEmployee);
router.get("/photo-categories", readRoles, getAnalyticsPhotoCategories);
router.get("/photo-types", readRoles, getAnalyticsPhotoTypes);
router.get("/store-coverage", readRoles, getAnalyticsStoreCoverage);

export default router;
