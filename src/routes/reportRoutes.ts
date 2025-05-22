import express from "express";
import { createReport, getReports } from "../controllers/reportController";
import middleware from "../utils/middleware";

const router = express.Router();

router.post("/", middleware.authorizeRole(["admin", "employee"]), createReport);
router.get("/", middleware.authorizeRole(["admin", "employee"]), getReports);

export default router;
