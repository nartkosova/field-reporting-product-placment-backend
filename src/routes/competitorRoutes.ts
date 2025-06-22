import express from "express";
import {
  createCompetitorBrand,
  getCompetitorBrands,
  getCompetitorBrandByName,
  getCompetitorBrandById,
  deleteCompetitorBrand,
  updateCompetitorBrand,
  getCompetitorByCategory,
  getAllCompetitorsWithCategories,
} from "../controllers/competitorController";
import middleware from "../utils/middleware";

const router = express.Router();

router.get(
  "/",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrands
);
router.get(
  "/name/:brand_name",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrandByName
);
router.get(
  "/id/:competitor_id",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorBrandById
);
router.get(
  "/category/:category",
  middleware.authorizeRole(["admin", "employee"]),
  getCompetitorByCategory
);
router.get(
  "/categories",
  middleware.authorizeRole(["admin", "employee"]),
  getAllCompetitorsWithCategories
);
router.post("/", middleware.authorizeRole(["admin"]), createCompetitorBrand);
router.put(
  "/:competitor_id",
  middleware.authorizeRole(["admin"]),
  updateCompetitorBrand
);
router.delete(
  "/:competitor_id",
  middleware.authorizeRole(["admin"]),
  deleteCompetitorBrand
);

export default router;
