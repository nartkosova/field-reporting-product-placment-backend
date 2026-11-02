import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket } from "mysql2";
import {
  assignUserToStore,
  createStoreWithUsers,
  getAssignedStores,
  getStoreUsers,
  getVisibleStores,
  parseUserIds,
  StoreAssignmentError,
  unassignUserFromStore,
} from "../services/storeAssignmentService";
import { hasAllStoresAccess } from "../utils/permissions";

const handleAssignmentError = (res: Response, error: unknown, context: string) => {
  if (error instanceof StoreAssignmentError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(`Error ${context}:`, error);
  res.status(500).json({ error: "Server error" });
};

export const getStores = async (req: Request, res: Response): Promise<void> => {
  const channel = req.query.channel as string | undefined;

  try {
    let query = `
      SELECT s.store_id, s.store_name, s.store_code, s.store_category,
             GROUP_CONCAT(u.user ORDER BY u.user SEPARATOR ', ') AS assigned_users
      FROM stores s
      LEFT JOIN store_users su ON su.store_id = s.store_id
      LEFT JOIN users u ON u.user_id = su.user_id
    `;
    const params: string[] = [];

    if (channel) {
      query += " WHERE s.store_channel = ?";
      params.push(channel);
    }

    query += `
      GROUP BY s.store_id, s.store_name, s.store_code, s.store_category
      ORDER BY s.store_name ASC
    `;
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
    // Admins also get the stores nobody is assigned to yet.
    const join = hasAllStoresAccess(req.user) ? "LEFT JOIN" : "JOIN";
    const [rows] = await db.promise().query<RowDataPacket[]>(`
      SELECT s.store_id, s.store_name, s.store_category, su.user_id
      FROM stores s
      ${join} store_users su ON su.store_id = s.store_id
      ORDER BY s.store_name ASC
    `);

    const stores = new Map<number, Record<string, unknown> & { user_ids: number[] }>();
    for (const { user_id, ...store } of rows) {
      const entry = stores.get(store.store_id) || { ...store, user_ids: [] };
      if (user_id !== null) entry.user_ids.push(user_id);
      stores.set(store.store_id, entry);
    }

    res.json([...stores.values()]);
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
    res.status(200).json(await getVisibleStores(Number(req.params.user_id)));
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUserAssignedStores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.json(await getAssignedStores(Number(req.params.user_id)));
  } catch (error) {
    handleAssignmentError(res, error, "fetching assigned stores");
  }
};

export const getStoreAssignedUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.json(await getStoreUsers(Number(req.params.store_id)));
  } catch (error) {
    handleAssignmentError(res, error, "fetching store users");
  }
};

export const addStoreUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await assignUserToStore(Number(req.params.store_id), Number(req.params.user_id));
    res.status(200).json({ message: "Marketi u caktua me sukses" });
  } catch (error) {
    handleAssignmentError(res, error, "assigning store");
  }
};

export const removeStoreUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await unassignUserFromStore(Number(req.params.store_id), Number(req.params.user_id));
    res.status(200).json({ message: "Marketi u largua me sukses" });
  } catch (error) {
    handleAssignmentError(res, error, "removing store assignment");
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
      user_ids,
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
      !location
    ) {
      res.status(400).json({
        error: "Të gjitha fushat përveq përdoruesit janë të nevojshme!",
      });
      return;
    }

    const userIds = parseUserIds(user_ids);
    if (!userIds) {
      res.status(400).json({ error: "Përdoruesit e zgjedhur janë të pavlefshëm" });
      return;
    }

    const id = await createStoreWithUsers(
      { store_name, store_code, store_channel, store_category, sales_rep, location },
      userIds
    );

    res.status(201).json({ id, message: "Shitorja u krijua me sukses" });
  } catch (error) {
    handleAssignmentError(res, error, "creating store");
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

export const getOtherStoreProducts = async (
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

    const storeCategory = storeResult[0].store_category;
    const categoryOrder = ["A", "B", "C", "D", "E", "F", "G"];
    const storeIndex = categoryOrder.indexOf(storeCategory);

    if (storeIndex === -1) {
      res.status(400).json({ error: "Invalid store category" });
      return;
    }

    // if category is A, no need to fetch unlisted products
    if (storeIndex === 0) {
      res.status(204).send();
      return;
    }

    const excludedCategories = categoryOrder.slice(0, storeIndex);
    const placeholders = excludedCategories.map(() => "?").join(",");

    const query = `
      SELECT product_id, category, name, product_category 
      FROM podravka_products 
      WHERE product_category IN (${placeholders})
    `;
    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, excludedCategories);

    res.json(products);
  } catch (error) {
    console.error("Error fetching unlisted products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getVFSStores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = `
      SELECT store_id, store_name, store_code, store_category FROM stores WHERE store_name LIKE '%VFS%' ORDER BY store_name ASC
    `;
    const [stores] = await db.promise().query<RowDataPacket[]>(query);
    res.json(stores);
  } catch (error) {
    console.error("Error fetching Viva Fresh stores:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getProexStores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = `
      SELECT store_id, store_name, store_code, store_category FROM stores WHERE store_name LIKE '%PROEX%' ORDER BY store_name ASC
    `;
    const [stores] = await db.promise().query<RowDataPacket[]>(query);
    res.json(stores);
  } catch (error) {
    console.error("Error fetching Interex stores:", error);
    res.status(500).json({ error: "Server error" });
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
      !location
    ) {
      res.status(400).json({
        error: "Të gjitha fushat përveq përdoruesit janë të nevojshme!",
      });
      return;
    }

    const query = `
      UPDATE stores
      SET store_name = ?, store_code = ?, store_channel = ?,
          store_category = ?, sales_rep = ?, location = ?
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
