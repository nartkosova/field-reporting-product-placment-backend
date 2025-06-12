import express from "express";
import {
  uploadReportPhoto,
  getAllReportPhotos,
  bulkDeletePhotos,
  getReportPhotosByUserId,
  deleteReportPhoto,
  getReportPhotoByPhotoId,
  updateReportPhoto,
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
router.get(
  "/report-photos/user",
  middleware.authorizeRole(["admin", "employee"]),
  getReportPhotosByUserId
);
router.get(
  "/report-photos/:photo_id",
  middleware.authorizeRole(["admin", "employee"]),
  getReportPhotoByPhotoId
);
router.put(
  "/report-photos/:photo_id",
  middleware.authorizeRole(["admin", "employee"]),
  upload.single("photo"),
  updateReportPhoto
);
router.delete(
  "/report-photos/:photo_id",
  middleware.authorizeRole(["admin", "employee"]),
  deleteReportPhoto
);

export default router;
