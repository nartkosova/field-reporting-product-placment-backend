import express from "express";
import {
  getStores,
  getStoreById,
  createStore,
  getStoreProducts,
  getStoreByUserId,
} from "../controllers/storeController";
const router = express.Router();

router.get("/", getStores);
router.get("/:store_id", getStoreById);
router.get("/user/:user_id", getStoreByUserId);
router.post("/", createStore);
router.get("/:store_id/products", getStoreProducts);

export default router;
