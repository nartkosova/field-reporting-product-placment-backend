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

    const user = req.user; // from middleware
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!category || !name || !podravka_code || !product_category) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `
      INSERT INTO podravka_products 
        (category, name, podravka_code, elkos_code, product_category) 
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(query, [
        category,
        name,
        podravka_code,
        elkos_code,
        product_category,
      ]);

    const insertId = (result as any).insertId;

    res
      .status(201)
      .json({ id: insertId, message: "Product added successfully!" });
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
    const { id } = req.params;
    const { brand_name } = req.body;
    if (!brand_name) {
      res.status(400).json({ error: "Mungon emri!" });
      return;
    }
    const query =
      "UPDATE competitor_brands SET brand_name = ? WHERE brand_id = ?";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [brand_name, id]);
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
    const { brand_id } = req.params;
    const query = "DELETE FROM competitor_brands WHERE competitor_id = ?";
    const [result] = await db.promise().query<OkPacket>(query, [brand_id]);
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
    if ("created_by" in req.body && req.body.created_by !== user.user_id) {
      res.status(403).json({
        error: "Manual assignment of created_by is not allowed.",
      });
      return;
    }
    const { id } = req.params;
    const query = "SELECT * FROM competitor_brands WHERE brand_id = ?";
    const [brands] = await db.promise().query<RowDataPacket[]>(query, [id]);
    if (brands.length === 0) {
      res.status(404).json({ error: "Kompetitor nuk egziston" });
      return;
    }
    res.json(brands[0]);
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const createCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { competitor_id, name, category, weight } = req.body;

    if ("created_by" in req.body && req.body.created_by !== user.user_id) {
      res.status(403).json({
        error: "Manual assignment of created_by is not allowed.",
      });
      return;
    }

    if (!competitor_id || !name || !category) {
      res.status(400).json({
        error: "competitor_id, name, and category are required!",
      });
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
        user.user_id,
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
