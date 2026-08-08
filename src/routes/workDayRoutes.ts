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

const router = express.Router();

router.get(
  "/report/detailed",
  middleware.authorizeRole(["admin"]),
  getDetailedWorkDaysReport
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
