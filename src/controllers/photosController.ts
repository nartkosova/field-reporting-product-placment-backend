import { Request, RequestHandler, Response } from "express";
import db from "../models/db";
import { extractPublicId } from "../utils/extractIds";
const { cloudinary } = require("../utils/cloudinary");
export const uploadReportPhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tokenUserId = req.user?.user_id;
    const { photo_type, category, store_id, photo_description, photo_stage } =
      req.body;

    if (!req.file || !photo_type || !category || !store_id || !tokenUserId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const file = req.file as Express.Multer.File;
    if (!file || !file.path) {
      res.status(400).json({ error: "Photo upload failed" });
      return;
    }

    const photoUrl = file.path;

    const query = `
      INSERT INTO report_photos 
        (photo_type, photo_url, photo_description, photo_stage, category, user_id, store_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.promise().execute(query, [
      photo_type,
      photoUrl,
      photo_description || null,
      photo_stage || "before", // Default if not specified
      category,
      tokenUserId,
      store_id,
    ]);

    res.status(201).json({
      message: "Photo uploaded successfully",
      url: photoUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllReportPhotos = async (req: Request, res: Response) => {
  try {
    const query = `
    SELECT
      rp.photo_id,
      rp.photo_type,
      rp.photo_url,
      rp.photo_description,
      rp.photo_stage,
      rp.category,
      rp.user_id,
      u.user AS user,
      rp.store_id,
      s.store_name,
      rp.uploaded_at
    FROM report_photos rp
    JOIN users u ON rp.user_id = u.user_id
    JOIN stores s ON rp.store_id = s.store_id
    ORDER BY rp.uploaded_at DESC
  `;

    const [results] = await db.promise().query(query);
    res.json(results);
  } catch (err) {
    console.error("Error fetching report photos:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const bulkDeletePhotos: RequestHandler = async (req, res) => {
  const { photoUrls } = req.body as { photoUrls: string[] };

  if (!Array.isArray(photoUrls)) {
    res.status(400).json({ error: "Invalid photoUrls array" });
    return;
  }

  try {
    const results = await Promise.all(
      photoUrls.map(async (url) => {
        const publicId = extractPublicId(url);
        console.log("Extracted public_id:", publicId);

        if (!publicId) {
          return { url, status: "failed", reason: "Invalid URL" };
        }

        const cloudRes = await cloudinary.uploader.destroy(publicId, {
          invalidate: true,
        });
        console.log("Cloudinary destroy result:", cloudRes);

        if (cloudRes.result !== "ok") {
          return { url, status: "failed", reason: cloudRes.result };
        }

        const [dbResult] = await db
          .promise()
          .query("DELETE FROM report_photos WHERE photo_url = ?", [url]);

        return {
          url,
          status: "success",
          dbAffected: (dbResult as any).affectedRows ?? 0,
        };
      })
    );

    res.status(200).json({ results });
  } catch (err) {
    console.error("Bulk deletion error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
