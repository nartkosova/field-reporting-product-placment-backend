import { Request, Response } from "express";
import db from "../../models/db";
import { OkPacket, RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export const getFacingsWithCompetitors = async (
  req: Request,
  res: Response
) => {
  try {
    const { user_id, store_id, category, start_date, end_date, limit, offset } =
      req.query;

    const conditions: string[] = [];
    const values: any[] = [];

    if (user_id) {
      conditions.push("pf.user_id = ?");
      values.push(user_id);
    }
    if (store_id) {
      conditions.push("pf.store_id = ?");
      values.push(store_id);
    }
    if (category) {
      conditions.push("pf.category = ?");
      values.push(category);
    }
    if (start_date && end_date) {
      conditions.push("pf.report_date BETWEEN ? AND ?");
      values.push(start_date, end_date);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const parsedLimit = parseInt(limit as string) || 20;
    const parsedOffset = parseInt(offset as string) || 0;

    const query = `
      SELECT 
        pf_data.user,
        pf_data.user_id,
        pf_data.store_name,
        pf_data.store_id,
        pf_data.category,
        DATE(pf_data.report_date) AS report_date,
        MAX(pf_data.total_facings) AS total_facings,
        JSON_OBJECTAGG(
          CONCAT(
            COALESCE(cb.brand_name, 'Unknown Brand'), 
            '-', 
            COALESCE(cf.competitor_id, 'UnknownID')
          ),
          COALESCE(cf.facings_count, 0)
        ) AS competitors,
        SUM(COALESCE(cf.facings_count, 0)) AS total_competitor_facings
      FROM (
        SELECT 
          u.user AS user,
          u.user_id,
          s.store_name,
          s.store_id,
          pf.category,
          pf.report_date,
          SUM(pf.facings_count) AS total_facings
        FROM podravka_facings pf
        JOIN users u ON pf.user_id = u.user_id
        JOIN stores s ON pf.store_id = s.store_id
        ${whereClause}
        GROUP BY u.user_id, s.store_id, pf.category, pf.report_date
        ORDER BY pf.report_date DESC
        LIMIT ? OFFSET ?
      ) AS pf_data
      LEFT JOIN competitor_facings cf 
        ON pf_data.user_id = cf.user_id 
        AND pf_data.store_id = cf.store_id 
        AND pf_data.category = cf.category 
        AND DATE(pf_data.report_date) = DATE(cf.report_date)
      LEFT JOIN competitor_brands cb ON cf.competitor_id = cb.competitor_id
      GROUP BY
        pf_data.user_id,
        pf_data.store_id,
        pf_data.category,
        DATE(pf_data.report_date)
    `;

    values.push(parsedLimit, parsedOffset);

    const [results] = await db.promise().query(query, values);

    const formatted = (results as RowDataPacket[]).map((row: any) => {
      const parsed =
        typeof row.competitors === "string"
          ? JSON.parse(row.competitors)
          : row.competitors || {};

      const simplified: Record<string, number> = {};
      for (const key in parsed) {
        const [brand] = key.split("-");
        simplified[brand] = (simplified[brand] || 0) + parsed[key];
      }

      return {
        user: row.user,
        user_id: row.user_id,
        store_name: row.store_name,
        store_id: row.store_id,
        category: row.category,
        report_date: row.report_date,
        total_facings: row.total_facings,
        competitors: simplified,
        total_competitor_facings: row.total_competitor_facings,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching facings with competitors:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorFacingByUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user_id = req.user?.user_id;
  if (!user_id) {
    res.status(401).json({ error: "Nuk jeni te autoreziaur" });
    return;
  }
  try {
    const query = `
      SELECT 
        cf.batch_id,
        s.store_name,
        cf.category,
        cf.report_date as report_date,
        COUNT(*) as product_count
      FROM competitor_facings cf
      JOIN stores s ON cf.store_id = s.store_id
      WHERE cf.user_id = ? AND batch_id IS NOT NULL
      GROUP BY cf.batch_id, cf.store_id, cf.category, cf.report_date
      ORDER BY cf.report_date DESC
    `;

    const [results] = await db
      .promise()
      .query<RowDataPacket[]>(query, [user_id]);

    if (results.length === 0) {
      res.status(404).json({ error: "No facings found for this user." });
      return;
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching competitor facings by user ID:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const getCompetitorFacingsByBatchId = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { batchId } = req.params;
  const user_id = req.user?.user_id;

  if (!batchId) {
    res.status(400).json({ error: "Batch ID is required." });
    return;
  }

  try {
    const query = `
      SELECT 
        cf.*,
        u.user AS user,
        s.store_name,
        cb.brand_name AS brand_name
      FROM competitor_facings cf
      JOIN users u ON cf.user_id = u.user_id
      JOIN stores s ON cf.store_id = s.store_id
      JOIN competitor_brands cb ON cf.competitor_id = cb.competitor_id
      WHERE cf.batch_id = ?
    `;

    const [results] = await db
      .promise()
      .query<RowDataPacket[]>(query, [batchId, user_id]);

    if (results.length === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching competitor facings by batch ID:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const batchCreateCompetitorFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user_id = req.user?.user_id;
  const facings = req.body;

  if (!user_id) {
    res.status(401).json({ error: "Nuk jeni te autoreziaur." });
    return;
  }

  if (!Array.isArray(facings) || facings.length === 0) {
    res.status(400).json({ error: "Facings array is required" });
    return;
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();
    const batchId = uuidv4();

    for (const facing of facings) {
      const {
        user_id: payloadUserId,
        store_id,
        competitor_id,
        category,
        batch_id = batchId,
        facings_count,
        name,
      } = facing;

      if (payloadUserId !== undefined && payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to submit facings for another user.",
        });
        await connection.rollback();
        connection.release();
        return;
      }

      if (!store_id || !category || facings_count == null) {
        res.status(400).json({
          error:
            "Each facing must include store_id, category, and facings_count.",
        });
        await connection.rollback();
        connection.release();
        return;
      }

      if (!competitor_id && !name) {
        res.status(400).json({
          error: "Each facing must include either competitor_id or brand name.",
        });
        await connection.rollback();
        connection.release();
        return;
      }

      // If competitor_id is missing but name is provided
      if (!competitor_id && name) {
        const [existingBrands] = await connection.query<any[]>(
          "SELECT competitor_id FROM competitor_brands WHERE LOWER(brand_name) = LOWER(?)",
          [name]
        );

        if (existingBrands.length > 0) {
          facing.competitor_id = existingBrands[0].competitor_id;
        } else {
          const [brandResult] = await connection.query<OkPacket>(
            "INSERT INTO competitor_brands (brand_name) VALUES (?)",
            [name]
          );
          facing.competitor_id = brandResult.insertId;
        }
      }

      // enforce user_id
      facing.user_id = user_id;
    }

    // Final values array using enforced user_id
    const values = facings.map((facing) => [
      facing.user_id,
      facing.store_id,
      facing.competitor_id,
      facing.category,
      facing.facings_count,
      facing.batch_id || batchId,
    ]);

    const insertFacingsQuery = `
        INSERT INTO competitor_facings 
        (user_id, store_id, competitor_id, category, facings_count, batch_id)
        VALUES ?`;

    await connection.query(insertFacingsQuery, [values]);
    await connection.commit();

    res
      .status(201)
      .json({ message: "Competitor facings batch created successfully!" });
  } catch (error) {
    console.error("Batch competitor facings error:", error);
    await connection.rollback();
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release();
  }
};

export const updateCompetitorFacingBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user_id = req.user?.user_id;
  const { batchId } = req.body;
  const facings = req.body?.facings;

  if (!user_id) {
    res.status(401).json({ error: "Nuk jeni te autoreziaur." });
    return;
  }

  if (!batchId || !Array.isArray(facings) || facings.length === 0) {
    res.status(400).json({ error: "batchId and facings array are required!" });
    return;
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    for (const facing of facings) {
      const {
        user_id: payloadUserId,
        store_id,
        competitor_id,
        category,
        facings_count,
      } = facing;

      if (payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to update facings for another user.",
        });
        await connection.rollback();
        connection.release();
        return;
      }

      if (!store_id || !competitor_id || !category || facings_count == null) {
        res.status(400).json({
          error:
            "Each facing must include store_id, competitor_id, category, and facings_count.",
        });
        await connection.rollback();
        connection.release();
        return;
      }

      await connection.query(
        `UPDATE competitor_facings 
         SET facings_count = ? 
         WHERE batch_id = ? AND store_id = ? AND competitor_id = ? AND category = ? AND user_id = ?`,
        [facings_count, batchId, store_id, competitor_id, category, user_id]
      );
    }

    await connection.commit();
    res
      .status(200)
      .json({ message: "Competitor facings updated successfully!" });
  } catch (error) {
    console.error("Error updating competitor facings batch:", error);
    await connection.rollback();
    res.status(500).json({ error: "Internal server error" });
  } finally {
    connection.release();
  }
};

export const deleteCompetitorFacingByBatchId = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { batchId } = req.params;

  if (!batchId) {
    res.status(400).json({ error: "Batch ID is required." });
    return;
  }

  try {
    const query = `
      DELETE FROM competitor_facings 
      WHERE batch_id = ?`;

    const [result] = await db.promise().query<OkPacket>(query, [batchId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.json({ message: "Competitor facings deleted successfully." });
  } catch (error) {
    console.error("Error deleting competitor facings by batch ID:", error);
    res.status(500).json({ error: "Server Error" });
  }
};
