import { Request, Response } from "express";
import db from "../models/db";
import { OkPacket, RowDataPacket } from "mysql2";

export const createPodravkaFacing = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id, store_id, product_id, category, facings_count } = req.body;
    if (!user_id || !store_id || !product_id || !category || !facings_count) {
      res.status(400).json({ error: "All fields are required!" });
      return;
    }
    const query =
      "INSERT INTO podravka_facings (user_id, store_id, product_id, category, facings_count) VALUES (?, ?, ?, ?, ?)";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [
        user_id,
        store_id,
        product_id,
        category,
        facings_count,
      ]);
    res.status(201).json({
      id: result.insertId,
      message: "Podravka facing added successfully!",
    });
  } catch (error) {
    console.error("Error adding Podravka facing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllPodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = "SELECT * FROM podravka_facings";
    const [podravka_facings] = await db.promise().query<RowDataPacket[]>(query);
    res.json(podravka_facings);
  } catch (error) {
    console.error("Error fetching podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createCategoryFacing = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      user_id,
      store_id,
      category,
      total_facings,
      competitor_total_facings,
      report_date,
    } = req.body;

    if (
      !user_id ||
      !store_id ||
      !category ||
      !total_facings ||
      !competitor_total_facings ||
      !report_date
    ) {
      res.status(400).json({ error: "All fields are required!" });
      return;
    }

    const query = `
        INSERT INTO podravka_category_facings 
        (user_id, store_id, category, total_facings, competitor_total_facings,report_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

    const [result] = await db
      .promise()
      .query<OkPacket>(query, [
        user_id,
        store_id,
        category,
        total_facings,
        competitor_total_facings,
        report_date,
      ]);

    res.status(201).json({
      id: result.insertId,
      message: "Category facing added successfully!",
    });
  } catch (error) {
    console.error("Error adding category facing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createCompetitorFacing = async (req: Request, res: Response) => {
  try {
    const { user_id, store_id, competitor_id, category, facings_count } =
      req.body;
    if (
      !user_id ||
      !store_id ||
      !competitor_id ||
      !category ||
      !facings_count
    ) {
      res.status(400).json({ error: "All fields are required!" });
      return;
    }
    const query =
      "INSERT INTO competitor_facings (user_id, store_id, competitor_id, category, facings_count) VALUES (?, ?, ?, ?, ?)";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [
        user_id,
        store_id,
        competitor_id,
        category,
        facings_count,
      ]);
    res.status(201).json({
      id: result.insertId,
      message: "Competitor facing added successfully!",
    });
  } catch (error) {
    console.error("Error adding competitor facing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getFacingsWithCompetitors = async (
  req: Request,
  res: Response
) => {
  try {
    const { user_id, store_id, category, start_date, end_date } = req.query;

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

    const query = `
    SELECT 
      pf_data.user,
      pf_data.user_id,
      pf_data.store_name,
      pf_data.store_id,
      pf_data.category,
      pf_data.report_date,
      pf_data.total_facings,
JSON_OBJECTAGG(
  CONCAT(
    COALESCE(cb.brand_name, 'UnknownBrand'), 
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
    ) AS pf_data
    LEFT JOIN competitor_facings cf 
      ON pf_data.user_id = cf.user_id 
      AND pf_data.store_id = cf.store_id 
      AND pf_data.category = cf.category 
      AND pf_data.report_date = cf.report_date
    LEFT JOIN competitor_brands cb ON cf.competitor_id = cb.competitor_id
    GROUP BY
      pf_data.user_id,
      pf_data.store_id,
      pf_data.category,
      pf_data.report_date
    `;

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

export const batchCreatePodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const facings = req.body; // expecting an array

    if (!Array.isArray(facings) || facings.length === 0) {
      res.status(400).json({ error: "Facings array is required!" });
      return;
    }

    // Validate each facing (basic check)
    for (const facing of facings) {
      const { user_id, store_id, product_id, category, facings_count } = facing;
      if (
        !user_id ||
        !store_id ||
        !product_id ||
        !category ||
        facings_count == null
      ) {
        res
          .status(400)
          .json({ error: "Each facing must have all fields filled!" });
        return;
      }
    }

    const values = facings.map((f) => [
      f.user_id,
      f.store_id,
      f.product_id,
      f.category,
      f.facings_count,
    ]);

    const query =
      "INSERT INTO podravka_facings (user_id, store_id, product_id, category, facings_count) VALUES ?";

    const [result] = await db.promise().query<OkPacket>(query, [values]);

    res.status(201).json({
      affectedRows: result.affectedRows,
      message: "Podravka facings batch added successfully!",
    });
  } catch (error) {
    console.error("Error batch adding Podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const batchCreateCompetitorFacings = async (
  req: Request,
  res: Response
) => {
  const facings = req.body;

  if (!Array.isArray(facings) || facings.length === 0) {
    res.status(400).json({ error: "Facings array is required" });
    return;
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    for (const facing of facings) {
      const {
        user_id,
        store_id,
        competitor_id,
        category,
        facings_count,
        name,
      } = facing;

      if (!user_id || !store_id || !category || facings_count == null) {
        throw new Error("Missing required facing fields");
      }

      if (!competitor_id && !name) {
        throw new Error("Either competitor_id or name is required");
      }

      // If competitor_id is missing but name is provided
      if (!competitor_id && name) {
        // Check if brand already exists
        const [existingBrands] = await connection.query<any[]>(
          "SELECT competitor_id FROM competitor_brands WHERE LOWER(brand_name) = LOWER(?)",
          [name]
        );

        if (existingBrands.length > 0) {
          facing.competitor_id = existingBrands[0].competitor_id;
        } else {
          // Insert new brand
          const [brandResult] = await connection.query<OkPacket>(
            "INSERT INTO competitor_brands (brand_name) VALUES (?)",
            [name]
          );
          facing.competitor_id = brandResult.insertId;
        }
      }
    }

    // Prepare bulk insert values after resolving competitor_id
    const values = facings.map((facing) => [
      facing.user_id,
      facing.store_id,
      facing.competitor_id,
      facing.category,
      facing.facings_count,
    ]);

    const insertFacingsQuery = `
      INSERT INTO competitor_facings 
        (user_id, store_id, competitor_id, category, facings_count)
      VALUES ?
    `;

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
