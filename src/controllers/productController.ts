import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category, name, podravka_code, elkos_code, product_category } =
      req.body;

    if (!category || !name || !podravka_code || !product_category) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `INSERT INTO podravka_products (category, name, podravka_code, elkos_code, product_category) 
    VALUES (?, ?, ?, ?, ?)`;
    const [result] = await db
      .promise()
      .query(query, [
        category,
        name,
        podravka_code,
        elkos_code,
        product_category,
      ]);

    const insertId = (result as any).insertId; // ✅ Extract insertId properly
    res
      .status(201)
      .json({ id: insertId, message: "Product added successfully!" });
    return;
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.query;

    let query = "SELECT * FROM podravka_products";
    const queryParams: any[] = [];

    if (category) {
      query += " WHERE category = ?";
      queryParams.push(category);
    }

    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, queryParams);

    if (products.length === 0) {
      res.status(404).json({ error: "No products found" });
      return;
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompetitorBrand = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { brand_name } = req.body;

    if (!brand_name) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `INSERT INTO competitor_brands (brand_name) 
    VALUES (?)`;
    const [result] = await db.promise().query(query, [brand_name]);

    const insertId = (result as any).insertId; // ✅ Extract insertId properly
    res
      .status(201)
      .json({ id: insertId, message: "Competitor brand added successfully!" });
  } catch (error) {
    console.error("Error adding competitor brand:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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

export const createCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { competitor_id, name, category, weight, created_by } = req.body;

    if (!competitor_id || !name || !category) {
      res
        .status(400)
        .json({ error: "competitor_id, name, and category are required!" });
      return;
    }

    const query = `
      INSERT INTO competitor_products
        (competitor_id, name, category, weight, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query<OkPacket>(query, [
        competitor_id,
        name,
        category,
        weight ?? null,
        created_by ?? null,
      ]);

    res.status(201).json({
      id: result.insertId,
      message: "Competitor product added successfully!",
    });
  } catch (error) {
    console.error("Error adding competitor product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getCompetitorProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category, competitor_id } = req.query;

    let query = "SELECT * FROM competitor_products WHERE 1=1";
    const params: any[] = [];

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (competitor_id) {
      query += " AND competitor_id = ?";
      params.push(competitor_id);
    }

    const [products] = await db.promise().query<RowDataPacket[]>(query, params);

    if (!products.length) {
      res.status(404).json({ error: "No competitor products found" });
      return;
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching competitor products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
