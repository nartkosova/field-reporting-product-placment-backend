import express from "express";
import {
  createPodravkaFacing,
  getAllPodravkaFacings,
  createCompetitorFacing,
  getFacingsWithCompetitors,
  batchCreatePodravkaFacings,
  batchCreateCompetitorFacings,
} from "../controllers/facingsController";
import middleware from "../utils/middleware";

const router = express.Router();

router.post(
  "/podravka-facing",
  middleware.authorizeRole(["admin", "employee"]),
  createPodravkaFacing
);
router.get(
  "/podravka-facing",
  middleware.authorizeRole(["admin", "employee"]),
  getAllPodravkaFacings
);
router.post(
  "/podravka-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  batchCreatePodravkaFacings
);
router.post(
  "/competitor-facing",
  middleware.authorizeRole(["admin", "employee"]),
  createCompetitorFacing
);
router.post(
  "/competitor-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  batchCreateCompetitorFacings
);
router.get(
  "/with-competitors",
  middleware.authorizeRole(["admin"]),
  getFacingsWithCompetitors
);

export default router;
