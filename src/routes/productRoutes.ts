import express from "express";
import {
  createProduct,
  getProducts,
  createCompetitorBrand,
  getCompetitorBrands,
  getCompetitorBrandByName,
  createCompetitorProduct,
  getCompetitorProducts,
} from "../controllers/productController";

const router = express.Router();

router.post("/", createProduct);
router.get("/", getProducts);
router.post("/competitor-brand", createCompetitorBrand);
router.get("/competitor-brand", getCompetitorBrands);
router.get("/competitor-brand/:brand_name", getCompetitorBrandByName);
router.post("/competitor", createCompetitorProduct);
router.get("/competitor", getCompetitorProducts);

export default router;
