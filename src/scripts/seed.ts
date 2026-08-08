import bcrypt from "bcryptjs";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import db from "../models/db";

type UserRole = "admin" | "employee" | "viewer";

const DEFAULT_PASSWORD = "test1234";

const ensureUser = async (user: string, role: UserRole) => {
  const [rows] = await db
    .promise()
    .query<RowDataPacket[]>("SELECT user_id FROM users WHERE user = ? LIMIT 1", [
      user,
    ]);

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  if (rows.length) {
    const userId = Number(rows[0].user_id);
    await db.promise().execute(
      "UPDATE users SET password = ?, role = ? WHERE user_id = ?",
      [hashedPassword, role, userId]
    );
    return userId;
  }

  const [result] = await db.promise().execute<ResultSetHeader>(
    "INSERT INTO users (user, password, role) VALUES (?, ?, ?)",
    [user, hashedPassword, role]
  );

  return result.insertId;
};

const ensureStore = async (store: {
  store_name: string;
  store_code: string;
  store_channel: "TT" | "MT";
  store_category: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "W" | "WHC";
  user_id: number | null;
  sales_rep: string;
  location: string;
}) => {
  await db.promise().execute(
    `
      INSERT INTO stores
        (store_name, store_code, store_channel, store_category, user_id, sales_rep, location)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        store_name = VALUES(store_name),
        store_channel = VALUES(store_channel),
        store_category = VALUES(store_category),
        user_id = VALUES(user_id),
        sales_rep = VALUES(sales_rep),
        location = VALUES(location)
    `,
    [
      store.store_name,
      store.store_code,
      store.store_channel,
      store.store_category,
      store.user_id,
      store.sales_rep,
      store.location,
    ]
  );
};

const ensureProduct = async (product: {
  business_unit: string;
  category: string;
  name: string;
  podravka_code: string;
  elkos_code: number | null;
  product_category: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  weight: number | null;
}) => {
  await db.promise().execute(
    `
      INSERT INTO podravka_products
        (business_unit, category, name, podravka_code, elkos_code, product_category, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        business_unit = VALUES(business_unit),
        category = VALUES(category),
        name = VALUES(name),
        elkos_code = VALUES(elkos_code),
        product_category = VALUES(product_category),
        weight = VALUES(weight)
    `,
    [
      product.business_unit,
      product.category,
      product.name,
      product.podravka_code,
      product.elkos_code,
      product.product_category,
      product.weight,
    ]
  );
};

const main = async () => {
  try {
    const adminId = await ensureUser("admin_demo", "admin");
    const employeeId = await ensureUser("employee_demo", "employee");
    const viewerId = await ensureUser("viewer_demo", "viewer");

    await ensureStore({
      store_name: "Viva Fresh Prishtine Center",
      store_code: "VFS-001",
      store_channel: "MT",
      store_category: "A",
      user_id: employeeId,
      sales_rep: "employee_demo",
      location: "Prishtine",
    });
    await ensureStore({
      store_name: "Interex Fushe Kosove",
      store_code: "INT-002",
      store_channel: "MT",
      store_category: "B",
      user_id: employeeId,
      sales_rep: "employee_demo",
      location: "Fushe Kosove",
    });
    await ensureStore({
      store_name: "Local Market Gjakove",
      store_code: "LM-003",
      store_channel: "TT",
      store_category: "C",
      user_id: viewerId,
      sales_rep: "viewer_demo",
      location: "Gjakove",
    });

    await ensureProduct({
      business_unit: "Culinary",
      category: "Soups",
      name: "Vegeta Chicken Soup 65g",
      podravka_code: "POD-1001",
      elkos_code: 1001,
      product_category: "A",
      weight: 65,
    });
    await ensureProduct({
      business_unit: "Culinary",
      category: "Seasoning",
      name: "Vegeta Original 250g",
      podravka_code: "POD-1002",
      elkos_code: 1002,
      product_category: "B",
      weight: 250,
    });
    await ensureProduct({
      business_unit: "Snacks",
      category: "Spreads",
      name: "Lino Lada Gold 350g",
      podravka_code: "POD-1003",
      elkos_code: 1003,
      product_category: "C",
      weight: 350,
    });

    console.log("Seed completed.");
    console.log("Users created or updated:");
    console.log(`- admin_demo / ${DEFAULT_PASSWORD} (admin)`);
    console.log(`- employee_demo / ${DEFAULT_PASSWORD} (employee)`);
    console.log(`- viewer_demo / ${DEFAULT_PASSWORD} (viewer)`);
    console.log(`Linked user ids: admin=${adminId}, employee=${employeeId}, viewer=${viewerId}`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

void main();
