import express from "express";
import {
  getStores,
  getStoreById,
  createStore,
  getStoreProducts,
  getStoreByUserId,
  deleteStore,
  updateStore,
  getStoresWithUserId,
  getOtherStoreProducts,
} from "../controllers/storeController";
import middleware from "../utils/middleware";
const router = express.Router();

router.get("/", middleware.authorizeRole(["admin", "employee"]), getStores);
router.get(
  "/user",
  middleware.authorizeRole(["admin", "employee"]),
  getStoresWithUserId
);
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
router.post("/", middleware.authorizeRole(["admin"]), createStore);
router.get(
  "/:store_id/products",
  middleware.authorizeRole(["admin", "employee"]),
  getStoreProducts
);
router.get(
  "/:store_id/other-products",
  middleware.authorizeRole(["admin", "employee"]),
  getOtherStoreProducts
);
router.put("/:store_id", middleware.authorizeRole(["admin"]), updateStore);
router.delete("/:store_id", middleware.authorizeRole(["admin"]), deleteStore);

export default router;
