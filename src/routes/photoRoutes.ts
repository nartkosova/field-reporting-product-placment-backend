import express from "express";
import {
  uploadReportPhoto,
  getAllReportPhotos,
  bulkDeletePhotos,
} from "../controllers/photosController";
const { upload } = require("../utils/cloudinary");

const router = express.Router();

router.post("/upload-photo", upload.single("photo"), uploadReportPhoto);
router.post("/bulk-delete", bulkDeletePhotos);
router.get("/report-photos", getAllReportPhotos);

export default router;
