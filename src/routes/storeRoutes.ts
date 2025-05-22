import express from "express";
import {
  getStores,
  getStoreById,
  createStore,
  getStoreProducts,
  getStoreByUserId,
} from "../controllers/storeController";
import middleware from "../utils/middleware";
const router = express.Router();

router.get("/", middleware.authorizeRole(["admin", "employee"]), getStores);
router.get(
  "/:store_id",
  middleware.authorizeRole(["admin", "employee"]),
  getStoreById
);
router.get(
  "/user/:user_id",
  middleware.authorizeRole(["employee", "admin"]),
  getStoreByUserId
);
router.post("/", middleware.authorizeRole(["admin", "employee"]), createStore);
router.get(
  "/:store_id/products",
  middleware.authorizeRole(["admin", "employee"]),
  getStoreProducts
);

export default router;
