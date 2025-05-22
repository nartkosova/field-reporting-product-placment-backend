import express from "express";
import {
  uploadReportPhoto,
  getAllReportPhotos,
  bulkDeletePhotos,
} from "../controllers/photosController";
import middleware from "../utils/middleware";
const { upload } = require("../utils/cloudinary");

const router = express.Router();

router.post(
  "/upload-photo",
  middleware.authorizeRole(["employee"]),
  upload.single("photo"),
  uploadReportPhoto
);
router.post(
  "/bulk-delete",
  middleware.authorizeRole(["admin"]),
  bulkDeletePhotos
);
router.get(
  "/report-photos",
  middleware.authorizeRole(["admin"]),
  getAllReportPhotos
);

export default router;
