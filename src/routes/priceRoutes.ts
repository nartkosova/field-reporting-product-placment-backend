import express from "express";
import {
  batchCreatePriceCheck,
  getPriceCheck,
} from "../controllers/priceController";
const router = express.Router();

router.post("/batch", batchCreatePriceCheck);
router.get("/", getPriceCheck);

export default router;
