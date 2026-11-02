import db from "../models/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { ASSIGNABLE_ROLES, canHoldStores } from "../utils/permissions";

export class StoreAssignmentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// The single definition of which stores a user can see: admins see all of
// them, everyone else sees what is assigned to them. Takes the SQL expression
// holding the store id, for use in any query's WHERE clause.
export const storeVisibleToUsers = (storeIdColumn: string, userIds: number[]) => {
  const placeholders = userIds.map(() => "?").join(",");

  return {
    sql: `(
      EXISTS (
        SELECT 1 FROM store_users su
        WHERE su.store_id = ${storeIdColumn} AND su.user_id IN (${placeholders})
      )
      OR EXISTS (
        SELECT 1 FROM users su_admin
        WHERE su_admin.user_id IN (${placeholders}) AND su_admin.role = 'admin'
      )
    )`,
    params: [...userIds, ...userIds],
  };
};

export const getVisibleStores = async (userId: number) => {
  const visible = storeVisibleToUsers("s.store_id", [userId]);
  const [stores] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT s.store_id, s.store_name, s.store_code, s.store_category
      FROM stores s
      WHERE ${visible.sql}
      ORDER BY s.store_name ASC
    `,
    visible.params
  );
  return stores;
};

export const getStoreUsers = async (storeId: number) => {
  const [stores] = await db
    .promise()
    .query<RowDataPacket[]>("SELECT store_id FROM stores WHERE store_id = ?", [storeId]);

  if (!stores.length) {
    throw new StoreAssignmentError(404, "Shitorja nuk ekziston");
  }

  const [users] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT u.user_id, u.user, u.role
      FROM store_users su
      JOIN users u ON u.user_id = su.user_id
      WHERE su.store_id = ?
      ORDER BY u.user ASC
    `,
    [storeId]
  );
  return users;
};

// Only what is really assigned, unlike getVisibleStores: this is the list an
// admin manages, so an admin's implicit access must not show up in it.
export const getAssignedStores = async (userId: number) => {
  const [stores] = await db.promise().query<RowDataPacket[]>(
    `
      SELECT s.store_id, s.store_name, s.store_code, s.store_category
      FROM store_users su
      JOIN stores s ON s.store_id = su.store_id
      WHERE su.user_id = ?
      ORDER BY s.store_name ASC
    `,
    [userId]
  );
  return stores;
};

export const assignUserToStore = async (storeId: number, userId: number) => {
  const [[stores], [users]] = await Promise.all([
    db.promise().query<RowDataPacket[]>("SELECT store_id FROM stores WHERE store_id = ?", [storeId]),
    db.promise().query<RowDataPacket[]>("SELECT role FROM users WHERE user_id = ?", [userId]),
  ]);

  if (!stores.length) {
    throw new StoreAssignmentError(404, "Shitorja nuk ekziston");
  }

  if (!users.length) {
    throw new StoreAssignmentError(404, "Përdoruesi nuk u gjet");
  }

  if (!canHoldStores(users[0].role)) {
    throw new StoreAssignmentError(400, "Këtij përdoruesi nuk mund t'i caktohen markete");
  }

  // Assigning twice is harmless: the unique key turns it into a no-op.
  await db
    .promise()
    .execute("INSERT IGNORE INTO store_users (store_id, user_id) VALUES (?, ?)", [storeId, userId]);
};

// Removes this one user only; everyone else stays assigned to the store.
export const unassignUserFromStore = async (storeId: number, userId: number) => {
  await db
    .promise()
    .execute("DELETE FROM store_users WHERE store_id = ? AND user_id = ?", [storeId, userId]);
};

export const parseUserIds = (value: unknown): number[] | null => {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) return null;

  const ids = value.map(Number);
  return ids.every((id) => Number.isInteger(id) && id > 0) ? [...new Set(ids)] : null;
};

export const createStoreWithUsers = async (
  store: {
    store_name: string;
    store_code: string;
    store_channel: string;
    store_category: string;
    sales_rep: string;
    location: string;
  },
  userIds: number[]
) => {
  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO stores
          (store_name, store_code, store_channel, store_category, sales_rep, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        store.store_name,
        store.store_code,
        store.store_channel,
        store.store_category,
        store.sales_rep,
        store.location,
      ]
    );

    if (userIds.length) {
      const [users] = await connection.query<RowDataPacket[]>(
        "SELECT user_id FROM users WHERE user_id IN (?) AND role IN (?)",
        [userIds, ASSIGNABLE_ROLES]
      );

      if (users.length !== userIds.length) {
        throw new StoreAssignmentError(400, "Një ose më shumë përdorues nuk mund të caktohen");
      }

      await connection.query("INSERT INTO store_users (store_id, user_id) VALUES ?", [
        userIds.map((userId) => [result.insertId, userId]),
      ]);
    }

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
