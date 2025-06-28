import express from "express";
import {
  getAllPodravkaFacings,
  getUserPPLBatches,
  getPodravkaFacingsByBatchId,
  batchCreatePodravkaFacings,
  updatePodravkaFacingsBatch,
  deletePodravkaFacingBatch,
  getPodravkaFacingsReport,
} from "../../controllers/facings_controllers/podravkaFacingsController";
import middleware from "../../utils/middleware";

const router = express.Router();

router.get(
  "/podravka-facing",
  middleware.authorizeRole(["admin", "employee"]),
  getAllPodravkaFacings
);
router.get(
  "/podravka-facing/batch/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  getPodravkaFacingsByBatchId
);
router.get(
  "/podravka-facing/report",
  middleware.authorizeRole(["admin", "employee"]),
  getPodravkaFacingsReport
);
router.get(
  "/podravka-facing/user-batches",
  middleware.authorizeRole(["admin", "employee"]),
  getUserPPLBatches
);
router.post(
  "/podravka-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  batchCreatePodravkaFacings
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

export default router;
