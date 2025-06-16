import express from "express";
import {
  batchCreateCompetitorFacings,
  deleteCompetitorFacingByBatchId,
  getCompetitorFacingByUserId,
  getCompetitorFacingsByBatchId,
  getFacingsWithCompetitors,
  updateCompetitorFacingBatch,
} from "../../controllers/facings_controllers/competitorFacingsController";
import middleware from "../../utils/middleware";

const router = express.Router();

router.post(
  "/competitor-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  batchCreateCompetitorFacings
);
router.get(
  "/with-competitors",
  middleware.authorizeRole(["admin", "employee"]),
  getFacingsWithCompetitors
);
router.get(
  "/competitor-facing/user",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorFacingByUserId
);
router.get(
  "/competitor-facing/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorFacingsByBatchId
);
router.put(
  "/competitor-facing/batch",
  middleware.authorizeRole(["admin", "employee"]),
  updateCompetitorFacingBatch
);
router.delete(
  "/competitor-facing/batch/:batchId",
  middleware.authorizeRole(["admin", "employee"]),
  deleteCompetitorFacingByBatchId
);

export default router;
