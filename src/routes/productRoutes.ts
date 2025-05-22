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
import middleware from "../utils/middleware";

const router = express.Router();

router.post(
  "/",
  middleware.authorizeRole(["admin", "employee"]),
  createProduct
);
router.get("/", middleware.authorizeRole(["admin", "employee"]), getProducts);
router.post(
  "/competitor-brand",
  middleware.authorizeRole(["admin", "employee"]),
  createCompetitorBrand
);
router.get(
  "/competitor-brand",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrands
);
router.get(
  "/competitor-brand/:brand_name",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrandByName
);
router.post(
  "/competitor",
  middleware.authorizeRole(["admin", "employee"]),
  createCompetitorProduct
);
router.get(
  "/competitor",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorProducts
);

export default router;
