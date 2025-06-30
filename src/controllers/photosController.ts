import { Request, RequestHandler, Response } from "express";
import db from "../models/db";
import { extractPublicId } from "../utils/extractIds";
import { RowDataPacket } from "mysql2";
const { cloudinary } = require("../utils/cloudinary");

export const uploadReportPhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tokenUserId = req.user?.user_id;
    const { photo_type, category, store_id, company, photo_description } =
      req.body;

    if (
      !req.file ||
      !photo_type ||
      !category ||
      !store_id ||
      !tokenUserId ||
      !company
    ) {
      res.status(400).json({ error: "Duhet te mbushen te gjitha fushat!" });
      return;
    }

    const file = req.file as Express.Multer.File;
    if (!file || !file.path) {
      res.status(400).json({ error: "Postimi i fotos deshtoj" });
      return;
    }

    const photoUrl = file.path;

    const query = `
      INSERT INTO report_photos 
        (photo_type, photo_url, photo_description, category, company, user_id, store_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db
      .promise()
      .execute(query, [
        photo_type,
        photoUrl,
        photo_description || null,
        category,
        company,
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
    const {
      limit = "50",
      offset = "0",
      user_ids,
      store_ids,
      categories,
      photo_types,
      company,
      start_date,
      end_date,
    } = req.query;

    const where: string[] = [];
    const values: any[] = [];

    const parseArray = (input: string | string[] | undefined): string[] =>
      input
        ? (Array.isArray(input) ? input : input.split(",")).map((s) => s.trim())
        : [];

    const userIds = parseArray(user_ids as string | string[] | undefined);
    const storeIds = parseArray(store_ids as string | string[] | undefined);
    const cats = parseArray(categories as string | string[] | undefined);
    const types = parseArray(photo_types as string | string[] | undefined);
    const companyVal = typeof company === "string" ? company.trim() : "";
    const startDate = start_date as string;
    const endDate = end_date as string;

    if (userIds.length) {
      where.push(`rp.user_id IN (${userIds.map(() => "?").join(",")})`);
      values.push(...userIds);
    }
    if (storeIds.length) {
      where.push(`rp.store_id IN (${storeIds.map(() => "?").join(",")})`);
      values.push(...storeIds);
    }
    if (cats.length) {
      where.push(`rp.category IN (${cats.map(() => "?").join(",")})`);
      values.push(...cats);
    }
    if (types.length) {
      where.push(`rp.photo_type IN (${types.map(() => "?").join(",")})`);
      values.push(...types);
    }

    if (companyVal) {
      where.push(`rp.company = ?`);
      values.push(companyVal);
    }
    if (startDate && endDate) {
      where.push(`DATE(rp.created_at) BETWEEN ? AND ?`);
      values.push(startDate, endDate);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const parsedLimit = parseInt(limit as string) || 50;
    const parsedOffset = parseInt(offset as string) || 0;

    const query = `
      SELECT
        rp.photo_id,
        rp.photo_type,
        rp.photo_url,
        rp.photo_description,
        rp.category,
        rp.company,
        rp.user_id,
        u.user AS user,
        rp.store_id,
        s.store_name,
        rp.created_at
      FROM report_photos rp
      JOIN users u ON rp.user_id = u.user_id
      JOIN stores s ON rp.store_id = s.store_id
      ${whereClause}
      ORDER BY rp.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [results] = await db
      .promise()
      .query(query, [...values, parsedLimit, parsedOffset]);

    const [countRows] = await db
      .promise()
      .query(
        `SELECT COUNT(*) AS total FROM report_photos rp ${whereClause}`,
        values
      );

    const total = (countRows as RowDataPacket[])[0].total;

    res.json({ data: results, total });
  } catch (err) {
    console.error("Error fetching report photos:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const bulkDeletePhotos: RequestHandler = async (req, res) => {
  const { photoUrls } = req.body as { photoUrls: string[] };

  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    res.status(400).json({ error: "URL i Fotos eshte invalide!" });
    return;
  }

  try {
    const results = await Promise.all(
      photoUrls.map(async (url) => {
        const publicId = extractPublicId(url);
        if (!publicId) {
          return { url, status: "failed", reason: "Invalid Cloudinary URL" };
        }

        let cloudResult: string;
        try {
          const cloudRes = await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
          });
          cloudResult = cloudRes.result;
        } catch (cloudErr) {
          console.error(`Cloudinary error for ${publicId}:`, cloudErr);
          cloudResult = "cloudinary-error";
        }

        let dbAffected = 0;
        try {
          const [dbRes] = await db
            .promise()
            .query("DELETE FROM report_photos WHERE photo_url = ?", [url]);
          dbAffected = (dbRes as any).affectedRows || 0;
        } catch (dbErr) {
          console.error(`DB delete error for ${url}:`, dbErr);
        }

        return {
          url,
          status:
            cloudResult === "ok" && dbAffected > 0
              ? "success"
              : cloudResult !== "ok"
              ? "cloudinary-failed"
              : "db-failed",
          cloudResult,
          dbAffected,
        };
      })
    );

    res.status(200).json({ results });
  } catch (err) {
    console.error("Unexpected bulk deletion error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const getReportPhotosByUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user_id = req.user?.user_id;

  if (!user_id) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  try {
    const query = `
      SELECT
        rp.photo_id,
        rp.photo_type,
        rp.photo_url,
        rp.photo_description,
        rp.category,
        rp.company,
        rp.user_id,
        u.user AS user,
        rp.store_id,
        s.store_name,
        rp.created_at
      FROM report_photos rp
      JOIN users u ON rp.user_id = u.user_id
      JOIN stores s ON rp.store_id = s.store_id
      WHERE rp.user_id = ?
      ORDER BY rp.created_at DESC
    `;

    const [results] = await db.promise().query(query, [user_id]);
    res.json(results);
  } catch (err) {
    console.error("Error fetching report photos by user ID:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReportPhotoByPhotoId = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { photo_id } = req.params;
  const user_id = req.user?.user_id;

  if (!photo_id) {
    res.status(400).json({ error: "Photo ID is required" });
    return;
  }

  if (!user_id) {
    res.status(401).json({ error: "Nuk jeni te autoreziaur" });
    return;
  }

  try {
    const query = `
      SELECT * FROM report_photos
      WHERE photo_id = ? AND user_id = ?
    `;

    const [results] = (await db
      .promise()
      .query(query, [photo_id, user_id])) as [RowDataPacket[], any];

    console.log("Query results:", results);

    if (results.length === 0) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Error fetching report photo by ID:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateReportPhoto = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { photo_id } = req.params;
  const { photo_type, category, store_id, photo_description } = req.body;

  if (!photo_id || !photo_type || !category || !store_id) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const [rows] = await db
      .promise()
      .query("SELECT photo_url FROM report_photos WHERE photo_id = ?", [
        photo_id,
      ]);
    const existing = (rows as any[])[0];

    if (!existing) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    let newPhotoUrl = existing.photo_url;

    if (req.file && req.file.path) {
      const publicId = extractPublicId(existing.photo_url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { invalidate: true });
      }

      const uploadRes = await cloudinary.uploader.upload(req.file.path, {
        folder: "podravka",
      });

      newPhotoUrl = uploadRes.secure_url;
    }

    const query = `
      UPDATE report_photos
      SET photo_type = ?, category = ?, store_id = ?, photo_description = ?, photo_url = ?
      WHERE photo_id = ?
    `;

    const [result] = await db
      .promise()
      .query(query, [
        photo_type,
        category,
        store_id,
        photo_description || null,
        newPhotoUrl,
        photo_id,
      ]);

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    res
      .status(200)
      .json({ message: "Photo updated successfully", url: newPhotoUrl });
  } catch (err) {
    console.error("Error updating report photo:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteReportPhoto: RequestHandler = async (req, res) => {
  const { photo_id } = req.params;

  if (!photo_id) {
    res.status(400).json({ error: "Photo ID is required" });
    return;
  }

  try {
    const [rows] = (await db
      .promise()
      .query("SELECT photo_url FROM report_photos WHERE photo_id = ?", [
        photo_id,
      ])) as [RowDataPacket[], any];

    if (rows.length === 0) {
      res.status(404).json({ error: "Fotoja nuk egziston" });
      return;
    }

    const photoUrl = rows[0].photo_url;

    const publicId = extractPublicId(photoUrl);
    if (!publicId) {
      res.status(400).json({ error: "Foto URL nuk esht korrekt" });
      return;
    }

    const cloudRes = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });

    if (cloudRes.result !== "ok") {
      res.status(500).json({ error: "Deshtim gjat fshirjes se fotos" });
      return;
    }

    await db
      .promise()
      .query("DELETE FROM report_photos WHERE photo_id = ?", [photo_id]);

    res.status(200).json({ message: "Fotoja u fshi me sukses" });
  } catch (err) {
    console.error("Error deleting report photo:", err);
    res.status(500).json({ error: "Server error" });
  }
};
