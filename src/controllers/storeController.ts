import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket } from "mysql2";

export const getStores = async (req: Request, res: Response): Promise<void> => {
  const channel = req.query.channel as string | undefined;

  try {
    let query = "SELECT store_id, store_name, store_category FROM stores";
    const params: string[] = [];

    if (channel) {
      query += " WHERE store_channel = ?";
      params.push(channel);
    }

    query += " ORDER BY store_name ASC";
    const [stores] = await db.promise().query<RowDataPacket[]>(query, params);

    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getStoresWithUserId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query =
      "SELECT store_id, store_name, store_category FROM stores WHERE user_id IS NOT NULL ORDER BY store_name ASC";
    const [stores] = await db.promise().query<RowDataPacket[]>(query);
    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ error: "Server error" });
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
      res.status(404).json({ error: "Shitorja nuk ekziston" });
      return;
    }

    res.json(stores[0]);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: "Server error" });
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

    const query = `
      SELECT store_id, store_name, store_code, store_category,
      FROM stores
      WHERE user_id IS NOT NULL AND user_id = ?
      ORDER BY store_name ASC
    `;

    const [stores] = await db
      .promise()
      .query<RowDataPacket[]>(query, [user_id]);

    if (stores.length === 0) {
      res
        .status(404)
        .json({ error: "Perdoruesi nuk ka asnje shitore te caktuar" });
      return;
    }

    res.status(200).json(stores);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: "Server error" });
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
      store_category,
      sales_rep,
      location,
      user_id,
    } = req.body;

    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    if (
      !store_name ||
      !store_code ||
      !store_channel ||
      !store_category ||
      !sales_rep ||
      !location ||
      !user_id
    ) {
      res.status(400).json({ error: "Të gjitha fushat janë të nevojshme!" });
      return;
    }

    const query = `
      INSERT INTO stores 
        (store_name, store_code, store_channel, store_category, user_id, sales_rep, location) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(query, [
        store_name,
        store_code,
        store_channel,
        store_category,
        user_id,
        sales_rep,
        location,
      ]);

    res.status(201).json({
      id: (result as any).insertId,
      message: "Shitorja u krijua me sukses",
    });
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({ error: "Server Error" });
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
      res.status(404).json({ error: "Shitorja nuk ekziston" });
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
      SELECT product_id, category, name, product_category 
      FROM podravka_products 
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

export const updateStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { store_id } = req.params;
    const {
      store_name,
      store_code,
      store_channel,
      store_category,
      sales_rep,
      location,
      user_id,
    } = req.body;
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }
    if (
      !store_name ||
      !store_code ||
      !store_channel ||
      !store_category ||
      !sales_rep ||
      !location ||
      !user_id
    ) {
      res.status(400).json({ error: "Të gjitha fushat janë të nevojshme!" });
      return;
    }
    const query = `
      UPDATE stores
      SET store_name = ?, store_code = ?, store_channel = ?,
          store_category = ?, sales_rep = ?, location = ?, user_id = ?
      WHERE store_id = ?
    `;
    const [result] = await db
      .promise()
      .query(query, [
        store_name,
        store_code,
        store_channel,
        store_category,
        sales_rep,
        location,
        user_id,
        store_id,
      ]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: "Shitorja nuk ekziston" });
      return;
    }
    res.status(200).json({ message: "Shitorja u perditsua me sukses" });
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { store_id } = req.params;

    const query = `DELETE FROM stores WHERE store_id = ?`;
    const [result] = await db.promise().query(query, [store_id]);

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: "Shitorja nuk ekziston" });
      return;
    }

    res.status(200).json({ message: "Shitorja u fshi me sukses." });
  } catch (error) {
    console.error("Error deleting store:", error);
    res.status(500).json({ error: "Server error" });
  }
};
