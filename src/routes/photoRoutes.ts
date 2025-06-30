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
import { uploadLimiter } from "../utils/rateLimiter";
const { upload } = require("../utils/cloudinary");

const router = express.Router();

router.get("/", middleware.authorizeRole(["admin"]), getAllReportPhotos);
router.get(
  "/user",
  middleware.authorizeRole(["admin", "employee"]),
  getReportPhotosByUserId
);
router.get(
  "/:photo_id",
  middleware.authorizeRole(["admin", "employee"]),
  getReportPhotoByPhotoId
);
router.post(
  "/upload-photo",
  uploadLimiter,
  middleware.authorizeRole(["employee"]),
  upload.single("photo"),
  uploadReportPhoto
);
router.post(
  "/bulk-delete",
  middleware.authorizeRole(["admin"]),
  bulkDeletePhotos
);
router.put(
  "/:photo_id",
  uploadLimiter,
  middleware.authorizeRole(["admin", "employee"]),
  upload.single("photo"),
  updateReportPhoto
);
router.delete(
  "/:photo_id",
  middleware.authorizeRole(["admin", "employee"]),
  deleteReportPhoto
);

export default router;
