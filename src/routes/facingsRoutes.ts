import express from "express";
import {
  createPodravkaFacing,
  getAllPodravkaFacings,
  createCompetitorFacing,
  createCategoryFacing,
  getFacingsWithCompetitors,
} from "../controllers/facingsController";

const router = express.Router();

router.post("/podravka-facing", createPodravkaFacing);
router.get("/podravka-facing", getAllPodravkaFacings);
router.post("/category-facing", createCategoryFacing);
router.post("/competitor-facing", createCompetitorFacing);
router.get("/with-competitors", getFacingsWithCompetitors);

export default router;
