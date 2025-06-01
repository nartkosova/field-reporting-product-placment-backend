import express from "express";
import {
  createProduct,
  getProducts,
  createCompetitorBrand,
  getCompetitorBrands,
  getCompetitorBrandByName,
  createCompetitorProduct,
  getCompetitorProducts,
  getCompetitorBrandById,
  deleteCompetitorBrand,
  updateCompetitorBrand,
  updateCompetitorProduct,
  deleteCompetitorProduct,
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
  middleware.authorizeRole(["admin"]),
  createCompetitorBrand
);
router.put(
  "/competitor-brand/:competitor_id",
  middleware.authorizeRole(["admin"]),
  updateCompetitorBrand
);
router.delete(
  "/competitor-brand/:competitor_id",
  middleware.authorizeRole(["admin"]),
  deleteCompetitorBrand
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
router.get(
  "/competitor-brand/id/:competitor_id",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrandById
);
router.post(
  "/competitor",
  middleware.authorizeRole(["admin"]),
  createCompetitorProduct
);
router.put(
  "/competitor/:product_id",
  middleware.authorizeRole(["admin"]),
  updateCompetitorProduct
);
router.delete(
  "/competitor/:product_id",
  middleware.authorizeRole(["admin"]),
  deleteCompetitorProduct
);
router.get(
  "/competitor",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorProducts
);

export default router;
