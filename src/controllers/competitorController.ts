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
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    const { competitor_id } = req.params;

    const query = `
      SELECT cb.*, GROUP_CONCAT(cbc.category) AS categories
      FROM competitor_brands cb
      LEFT JOIN competitor_brand_categories cbc ON cb.competitor_id = cbc.competitor_id
      WHERE cb.competitor_id = ?
      GROUP BY cb.competitor_id
    `;

    const [brands] = await db
      .promise()
      .query<RowDataPacket[]>(query, [competitor_id]);

    if (brands.length === 0) {
      res.status(404).json({ error: "Kompetitori nuk ekziston" });
      return;
    }

    const brand = brands[0];
    brand.categories = brand.categories
      ? (brand.categories as string).split(",")
      : [];

    res.json(brand);
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
    const { brand_name, categories } = req.body;
    const user = req.user;

    if (!user?.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    if (!brand_name || !Array.isArray(categories) || categories.length === 0) {
      res.status(400).json({
        error: "Brand name and at least one category must be provided.",
      });
      return;
    }

    const [existingRows] = await db
      .promise()
      .query<RowDataPacket[]>(
        "SELECT competitor_id FROM competitor_brands WHERE brand_name = ?",
        [brand_name]
      );

    let competitorId: number;

    if (existingRows.length > 0) {
      competitorId = existingRows[0].competitor_id;
    } else {
      const [result] = await db
        .promise()
        .query("INSERT INTO competitor_brands (brand_name) VALUES (?)", [
          brand_name,
        ]);
      competitorId = (result as any).insertId;
    }

    const insertValues = categories.map((cat: string) => [
      competitorId,
      cat.trim(),
    ]);

    await db
      .promise()
      .query(
        "INSERT IGNORE INTO competitor_brand_categories (competitor_id, category) VALUES ?",
        [insertValues]
      );

    res.status(201).json({
      id: competitorId,
      message: "Konkurrenti u shtua me sukses",
    });
  } catch (error) {
    console.error("Error adding competitor brand:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const updateCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user?.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    const { competitor_id } = req.params;
    const { brand_name, categories } = req.body;

    if (!brand_name || !Array.isArray(categories)) {
      res
        .status(400)
        .json({ error: "Emri dhe kategoritë janë të detyrueshme!" });
      return;
    }

    const updateQuery =
      "UPDATE competitor_brands SET brand_name = ? WHERE competitor_id = ?";
    const [updateResult] = await db
      .promise()
      .query<OkPacket>(updateQuery, [brand_name, competitor_id]);

    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: "Konkurrenti nuk ekziston." });
      return;
    }

    await db
      .promise()
      .query(
        "DELETE FROM competitor_brand_categories WHERE competitor_id = ?",
        [competitor_id]
      );

    const insertValues = categories.map((cat: string) => [
      competitor_id,
      cat.trim(),
    ]);

    await db
      .promise()
      .query(
        "INSERT INTO competitor_brand_categories (competitor_id, category) VALUES ?",
        [insertValues]
      );

    res.json({
      message: "Konkurrenca dhe kategoritë u përditësuan me sukses.",
    });
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({ error: "Gabim në server." });
  }
};

export const deleteCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
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
