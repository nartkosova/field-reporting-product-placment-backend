import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket } from "mysql2";
export const getStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = "SELECT * FROM stores WHERE user_id IS NOT NULL";
    const [stores] = await db.promise().query<RowDataPacket[]>(query);
    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStoreById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { store_id } = req.params;
    const query = "SELECT * FROM stores WHERE store_id = ?";
    const [stores] = await db
      .promise()
      .query<RowDataPacket[]>(query, [store_id]);

    if (stores.length === 0) {
      res.status(404).json({ error: "Store not found" });
      return;
    }

    res.json(stores[0]);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const getStoreNameById = async (
  store_id: number
): Promise<string | null> => {
  const [rows]: any = await db
    .promise()
    .query(`SELECT store_name FROM stores WHERE store_id = ?`, [store_id]);
  return rows.length > 0 ? rows[0].store_name : null;
};
export const getStoreByUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id } = req.params;
    const query =
      "SELECT * FROM stores WHERE user_id IS NOT NULL AND user_id = ?";
    const [stores] = await db
      .promise()
      .query<RowDataPacket[]>(query, [user_id]);

    if (stores.length === 0) {
      res.status(404).json({ error: "User has no stores" });
      return;
    }

    res.status(200).json(stores);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      store_name,
      store_code,
      store_channel,
      store_group,
      store_category,
      merchandiser,
      location,
    } = req.body;

    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if ("user_id" in req.body && req.body.user_id !== user.user_id) {
      res
        .status(403)
        .json({ error: "Manual assignment of user_id is not allowed." });
      return;
    }

    if (
      !store_name ||
      !store_code ||
      !store_channel ||
      !store_group ||
      !store_category ||
      !merchandiser ||
      !location
    ) {
      res.status(400).json({ error: "All fields are required!" });
      return;
    }

    const query = `
      INSERT INTO stores 
        (store_name, store_code, store_channel, store_group, store_category, merchandiser, location, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(query, [
        store_name,
        store_code,
        store_channel,
        store_group,
        store_category,
        merchandiser,
        location,
        user.user_id,
      ]);

    res.status(201).json({
      id: (result as any).insertId,
      message: "Store created successfully!",
    });
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getStoreProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { store_id } = req.params;

    const storeQuery = "SELECT store_category FROM stores WHERE store_id = ?";
    const [storeResult] = await db
      .promise()
      .query<RowDataPacket[]>(storeQuery, [store_id]);

    if (storeResult.length === 0) {
      res.status(404).json({ error: "Store not found" });
      return;
    }

    const store_category = storeResult[0].store_category;

    const categoryOrder = ["A", "B", "C", "D", "E", "F", "G"];
    const storeCategoryIndex = categoryOrder.indexOf(store_category);
    if (storeCategoryIndex === -1) {
      res.status(400).json({ error: "Invalid store category" });
      return;
    }

    const allowedCategories = categoryOrder.slice(storeCategoryIndex);
    const placeholders = allowedCategories.map(() => "?").join(",");

    const query = `
      SELECT * FROM podravka_products 
      WHERE product_category IN (${placeholders})
    `;
    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, allowedCategories);

    res.json(products);
  } catch (error) {
    console.error("Error fetching store products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
