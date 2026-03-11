import express from "express";
import {
  getAllPodravkaFacings,
  getUserPPLBatches,
  getUserPresenceBatches,
  getPodravkaFacingsByBatchId,
  getPodravkaPresenceByBatchId,
  batchCreatePodravkaFacings,
  updatePodravkaFacingsBatch,
  deletePodravkaFacingBatch,
  getPodravkaFacingsReport,
  getPodravkaPresenceReport,
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
  "/podravka-facing/presence-batch/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  getPodravkaPresenceByBatchId
);
router.get(
  "/podravka-facing/report",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getPodravkaFacingsReport
);
router.get(
  "/podravka-facing/presence-report",
  middleware.authorizeRole(["admin", "employee", "viewer"]),
  getPodravkaPresenceReport
);
router.get(
  "/podravka-facing/user-batches",
  middleware.authorizeRole(["admin", "employee"]),
  getUserPPLBatches
);
router.get(
  "/podravka-facing/user-presence-batches",
  middleware.authorizeRole(["admin", "employee"]),
  getUserPresenceBatches
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
