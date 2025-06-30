import express from "express";
import {
  createProduct,
  getProducts,
  createCompetitorProduct,
  getCompetitorProducts,
  updateCompetitorProduct,
  deleteCompetitorProduct,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductByIdWithRanking,
  getProductsByCategory,
} from "../controllers/productController";
import middleware from "../utils/middleware";

const router = express.Router();

router.get("/", middleware.authorizeRole(["admin", "employee"]), getProducts);
router.get(
  "/competitor",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorProducts
);
router.get("/categories", getProductCategories);
router.get(
  "/:product_id",
  middleware.authorizeRole(["admin", "employee"]),
  getProductByIdWithRanking
);
router.get(
  "/category/:category",
  middleware.authorizeRole(["admin", "employee"]),
  getProductsByCategory
);
router.post(
  "/",
  middleware.authorizeRole(["admin", "employee"]),
  createProduct
);
router.put("/:product_id", middleware.authorizeRole(["admin"]), updateProduct);
router.delete(
  "/:product_id",
  middleware.authorizeRole(["admin"]),
  deleteProduct
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

export default router;
