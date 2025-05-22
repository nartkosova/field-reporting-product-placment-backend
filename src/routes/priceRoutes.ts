import express from "express";
import {
  batchCreatePriceCheck,
  getPriceCheck,
} from "../controllers/priceController";
import middleware from "../utils/middleware";
const router = express.Router();

router.post(
  "/batch",
  middleware.authorizeRole(["admin", "employee"]),
  batchCreatePriceCheck
);
router.get("/", middleware.authorizeRole(["admin", "employee"]), getPriceCheck);

export default router;
