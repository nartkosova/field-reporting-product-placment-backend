import express from "express";
import {
  createPodravkaFacing,
  getAllPodravkaFacings,
  createCompetitorFacing,
  createCategoryFacing,
  getFacingsWithCompetitors,
  batchCreatePodravkaFacings,
  batchCreateCompetitorFacings,
} from "../controllers/facingsController";

const router = express.Router();

router.post("/podravka-facing", createPodravkaFacing);
router.get("/podravka-facing", getAllPodravkaFacings);
router.post("/podravka-facing/batch", batchCreatePodravkaFacings);
router.post("/category-facing", createCategoryFacing);
router.post("/competitor-facing", createCompetitorFacing);
router.post("/competitor-facing/batch", batchCreateCompetitorFacings);
router.get("/with-competitors", getFacingsWithCompetitors);

export default router;
