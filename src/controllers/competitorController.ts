import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";

export const getCompetitorBrands = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = "SELECT * FROM competitor_brands";
    const [brands] = await db.promise().query<RowDataPacket[]>(query);

    if (brands.length === 0) {
      res.status(404).json({ error: "No brands found" });
      return;
    }

    res.json(brands);
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorBrandByName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const query = "SELECT * FROM competitor_brands WHERE brand_name = ?";
    const [brands] = await db.promise().query<RowDataPacket[]>(query, [id]);

    if (brands.length === 0) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    res.json(brands[0]);
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.params;
    if (!category) {
      res.status(400).json({ error: "Category is required" });
      return;
    }
    const query = `
          SELECT cb.competitor_id, cb.brand_name
          FROM competitor_brands cb
          JOIN competitor_brand_categories cbc ON cb.competitor_id = cbc.competitor_id
          WHERE cbc.category = ?
        `;
    const [competitors] = await db
      .promise()
      .query<RowDataPacket[]>(query, [category]);
    if (competitors.length === 0) {
      res.status(404).json({ error: "No competitors found for this category" });
      return;
    }
    res.json(competitors);
  } catch (error) {
    console.error("Error fetching competitors by category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorBrandById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { competitor_id } = req.params;
    const query = "SELECT * FROM competitor_brands WHERE competitor_id = ?";
    const [brands] = await db
      .promise()
      .query<RowDataPacket[]>(query, [competitor_id]);
    if (brands.length === 0) {
      res.status(404).json({ error: "Kompetitori nuk egziston" });
      return;
    }
    res.json(brands[0]);
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const createCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { brand_name } = req.body;

    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!brand_name) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `INSERT INTO competitor_brands (brand_name) VALUES (?)`;
    const [result] = await db.promise().query(query, [brand_name]);

    const insertId = (result as any).insertId;
    res
      .status(201)
      .json({ id: insertId, message: "Competitor brand added successfully!" });
  } catch (error) {
    console.error("Error adding competitor brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { competitor_id } = req.params;
    const { brand_name } = req.body;
    if (!brand_name) {
      res.status(400).json({ error: "Mungon emri!" });
      return;
    }
    const query =
      "UPDATE competitor_brands SET brand_name = ? WHERE competitor_id = ?";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [brand_name, competitor_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Konkurrenti nuk egziston" });
      return;
    }
    res.json({ message: "Konkurrenca u perditsua me sukses" });
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { competitor_id } = req.params;
    const checkQuery = `
    SELECT COUNT(*) AS count FROM competitor_facings WHERE competitor_id = ?
  `;
    const checkResult = await db.promise().query(checkQuery, [competitor_id]);
    const count = (checkResult[0] as RowDataPacket[])[0].count;

    if (count > 0) {
      res.status(400).json({
        error:
          "Nuk mund të fshihet brandi sepse është i lidhur me të dhëna ekzistuese.",
      });
      return;
    }
    const query = "DELETE FROM competitor_brands WHERE competitor_id = ?";
    const [result] = await db.promise().query<OkPacket>(query, [competitor_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Konkurrenti nuk egziston" });
      return;
    }
    res.json({ message: "Konkurrenti u fshi me sukses" });
  } catch (error) {
    console.error("Error deleting brand:", error);
    res.status(500).json({ error: "Server Error" });
  }
};
