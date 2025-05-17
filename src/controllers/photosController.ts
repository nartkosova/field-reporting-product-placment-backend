import { Request, Response } from "express";
import db from "../models/db";

export const uploadReportPhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { photo_type, category, user_id, store_id } = req.body;

    if (!req.file || !photo_type || !category || !user_id || !store_id) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const photoUrl = (req.file as Express.Multer.File).path;

    const query = `
      INSERT INTO report_photos 
        (photo_type, photo_url, category, user_id, store_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db
      .promise()
      .execute(query, [photo_type, photoUrl, category, user_id, store_id]);

    res
      .status(201)
      .json({ message: "Photo uploaded successfully", url: photoUrl });
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
