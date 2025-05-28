import express from "express";
import {
  createPodravkaFacing,
  getAllPodravkaFacings,
  createCompetitorFacing,
  getFacingsWithCompetitors,
  batchCreatePodravkaFacings,
  batchCreateCompetitorFacings,
  updatePodravkaFacingsBatch,
  getPodravkaFacingsByBatchId,
  getUserPPLBatches,
  deletePodravkaFacingBatch,
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
router.put(
  "/podravka-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  updatePodravkaFacingsBatch
);
router.delete(
  "/podravka-facing/batch/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  deletePodravkaFacingBatch
);
router.get(
  "/podravka-facing/batch/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  getPodravkaFacingsByBatchId
);

router.get(
  "/podravka-facing/user-batches",
  middleware.authorizeRole(["admin", "employee"]),
  getUserPPLBatches
);

export default router;
