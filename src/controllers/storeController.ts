import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket } from "mysql2";
export const getStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = "SELECT * FROM stores";
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
      user_id,
    } = req.body;

    if (
      !store_name ||
      !store_code ||
      !store_channel ||
      !store_group ||
      !store_category ||
      !merchandiser ||
      !location ||
      !user_id
    ) {
      res.status(400).json({ error: "All fields are required!" });
      return;
    }

    const query = `INSERT INTO stores (store_name, store_code, store_channel, store_group, store_category, merchandiser, location, user_id) ) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db
      .promise()
      .query(query, [
        store_name,
        store_code,
        store_channel,
        store_category,
        merchandiser,
        location,
        user_id,
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

    const storeQuery = "SELECT store_category FROM stores WHERE store_id = ?"; //duhet me qit products foreign key edhe user
    const [storeResult] = await db
      .promise()
      .query<RowDataPacket[]>(storeQuery, [store_id]);
    if (storeResult.length === 0) {
      res.status(404).json({ error: "Store not found" });
      return;
    }

    const store_category = storeResult[0].store_category;

    const query = `
      SELECT * FROM podravka_products 
      WHERE product_category <= ?
    `;
    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, [store_category]);

    res.json(products);
  } catch (error) {
    console.error("Error fetching store products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
