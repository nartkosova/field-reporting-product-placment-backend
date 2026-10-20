import express from "express";
import middleware from "../utils/middleware";
import {
  createWorkDay,
  getDetailedWorkDaysReport,
  getLatestKilometers,
  getWorkDayById,
  getWorkDays,
  removeWorkDay,
  updateWorkDay,
} from "../controllers/workDayController";
import {
  getDayOverviewReport,
  getDayAttendance,
  postDayCheckIn,
  postDayCheckOut,
  postStoreVisit,
  postStoreVisitCheckOut,
  postStoreVisitPhoto,
} from "../controllers/attendanceController";
import { uploadLimiter } from "../utils/rateLimiter";
const { upload } = require("../utils/cloudinary");

const router = express.Router();

router.get(
  "/report/detailed",
  middleware.authorizeRole(["admin"]),
  getDetailedWorkDaysReport
);
router.get(
  "/report/overview",
  middleware.authorizeRole(["admin"]),
  getDayOverviewReport
);
router.get(
  "/:work_log_day_id/attendance",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getDayAttendance
);
router.post(
  "/:work_log_day_id/check-in",
  middleware.authorizeRole(["admin", "employee"]),
  postDayCheckIn
);
router.post(
  "/:work_log_day_id/check-out",
  middleware.authorizeRole(["admin", "employee"]),
  postDayCheckOut
);
router.post(
  "/:work_log_day_id/visits",
  middleware.authorizeRole(["admin", "employee"]),
  postStoreVisit
);
router.post(
  "/:work_log_day_id/visits/:store_visit_id/check-out",
  middleware.authorizeRole(["admin", "employee"]),
  postStoreVisitCheckOut
);
router.post(
  "/:work_log_day_id/visits/:store_visit_id/photos",
  uploadLimiter,
  middleware.authorizeRole(["admin", "employee"]),
  upload.single("photo"),
  postStoreVisitPhoto
);
router.get(
  "/latest-kilometers",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getLatestKilometers
);
router.get(
  "/",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getWorkDays
);
router.get(
  "/:work_log_day_id",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getWorkDayById
);
router.post(
  "/",
  middleware.authorizeRole(["admin", "employee"]),
  createWorkDay
);
router.put(
  "/:work_log_day_id",
  middleware.authorizeRole(["admin", "employee"]),
  updateWorkDay
);
router.delete(
  "/:work_log_day_id",
  middleware.authorizeRole(["admin", "employee"]),
  removeWorkDay
);

export default router;
