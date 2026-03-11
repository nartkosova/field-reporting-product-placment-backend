import { Request, Response } from "express";
import db from "../../models/db";
import { OkPacket, RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";

export const getAllPodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = "SELECT * FROM podravka_facings";
    const [podravka_facings] = await db.promise().query<RowDataPacket[]>(query);
    res.json(podravka_facings);
  } catch (error) {
    console.error("Error fetching podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserPPLBatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    // Ensure limit and offset are numbers (important for LIMIT/OFFSET syntax in some DBs)
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const query = `
      SELECT 
        pf.batch_id,
        s.store_name,
        pf.category,
        pf.created_at,
        COUNT(*) as product_count
      FROM podravka_facings pf
      JOIN stores s ON pf.store_id = s.store_id
      WHERE pf.user_id = ? 
        AND pf.batch_id IS NOT NULL 
        AND pf.record_type != 'PRESENCE'
      GROUP BY pf.batch_id, pf.store_id, pf.category, pf.created_at
      ORDER BY pf.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db
      .promise()
      .query<RowDataPacket[]>(query, [user_id, limit, offset]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching PPL batches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserPresenceBatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autorizuar" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const query = `
      SELECT 
        lb.batch_id,
        s.store_name,
        lb.created_at,
        COUNT(pf.product_id) as product_count
      FROM (
        SELECT 
          pf.store_id,
          MAX(pf.created_at) AS created_at,
          MAX(pf.batch_id) AS batch_id
        FROM podravka_facings pf
        JOIN (
          SELECT store_id, MAX(created_at) AS max_created_at
          FROM podravka_facings
          WHERE user_id = ? 
            AND record_type = 'PRESENCE'
          GROUP BY store_id
        ) latest ON pf.store_id = latest.store_id
                 AND pf.created_at = latest.max_created_at
        WHERE pf.user_id = ? 
          AND pf.record_type = 'PRESENCE'
        GROUP BY pf.store_id
      ) lb
      JOIN stores s ON lb.store_id = s.store_id
      JOIN podravka_facings pf ON pf.batch_id = lb.batch_id
      GROUP BY lb.batch_id, lb.store_id, lb.created_at, s.store_name
      ORDER BY lb.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await db
      .promise()
      .query<RowDataPacket[]>(query, [user_id, user_id, limit, offset]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching presence batches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPodravkaFacingsReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      user_id,
      store_id,
      categories,
      start_date,
      end_date,
      business_unit,
      limit,
      offset,
    } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];

    const userIds = Array.isArray(user_id) ? user_id : user_id ? [user_id] : [];
    const storeIds = Array.isArray(store_id)
      ? store_id
      : store_id
      ? [store_id]
      : [];
    const categoryList = Array.isArray(categories)
      ? categories
      : categories
      ? [categories]
      : [];

    conditions.push(`pf.record_type = 'FACINGS'`);

    if (userIds.length) {
      conditions.push(`pf.user_id IN (${userIds.map(() => "?").join(",")})`);
      values.push(...userIds);
    }
    if (business_unit) {
      conditions.push(`pp.business_unit = ?`);
      values.push(business_unit);
    }
    if (storeIds.length) {
      conditions.push(`pf.store_id IN (${storeIds.map(() => "?").join(",")})`);
      values.push(...storeIds);
    }
    if (categoryList.length) {
      conditions.push(
        `pf.category IN (${categoryList.map(() => "?").join(",")})`
      );
      values.push(...categoryList);
    }

    if (start_date && end_date) {
      conditions.push(`DATE(pf.created_at) BETWEEN ? AND ?`);
      values.push(start_date, end_date);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countQuery = `
      SELECT COUNT(DISTINCT pp.product_id) AS total
      FROM podravka_facings pf
      JOIN podravka_products pp ON pf.product_id = pp.product_id
      JOIN stores s ON pf.store_id = s.store_id
      JOIN users u ON pf.user_id = u.user_id
      ${whereClause}
    `;

    const [countRows] = await db.promise().query(countQuery, [...values]);
    const total = (countRows as RowDataPacket[])[0].total;

    const parsedLimit = parseInt(limit as string) || 50;
    const parsedOffset = parseInt(offset as string) || 0;

    const totalsQuery = `
    SELECT pp.category AS product_category, SUM(pf.facings_count) AS total_facings
    FROM podravka_facings pf
    JOIN podravka_products pp ON pf.product_id = pp.product_id
    ${whereClause}
    GROUP BY pp.category
  `;

    const [totalsRows] = await db.promise().query(totalsQuery, values.slice(0)); // no limit/offset
    const categoryTotals = Object.fromEntries(
      (totalsRows as RowDataPacket[]).map((row) => [
        row.product_category,
        row.total_facings,
      ])
    );

    const dataQuery = `
      SELECT 
        pp.product_id,
        pp.business_unit,
        pp.podravka_code,
        pp.elkos_code,

        pp.name AS product_name,
        pp.category AS product_category,
        pr.category_rank AS product_category_rank,
        pr.category_sales_share,
        SUM(pf.facings_count) AS total_facings
      FROM podravka_facings pf
      JOIN podravka_products pp ON pf.product_id = pp.product_id
      LEFT JOIN product_rankings pr ON pr.product_id = pp.product_id
        AND pr.year = (
          SELECT MAX(year)
          FROM product_rankings
          WHERE product_id = pp.product_id
        )
      JOIN stores s ON pf.store_id = s.store_id
      JOIN users u ON pf.user_id = u.user_id
      ${whereClause}
      GROUP BY pp.product_id, pp.name, pp.category, pr.category_rank, pr.category_sales_share, pp.business_unit, pp.podravka_code, pp.elkos_code
      ORDER BY total_facings DESC
      LIMIT ? OFFSET ?
    `;

    values.push(parsedLimit, parsedOffset);

    const [results] = await db.promise().query(dataQuery, values);

    const enrichedResults = (results as RowDataPacket[]).map((row) => {
      const total = categoryTotals[row.product_category] || 1;
      const percentage = (row.total_facings / total) * 100;
      return {
        ...row,
        facing_percentage_in_category: parseFloat(percentage.toFixed(2)),
      };
    });

    res.json({ data: enrichedResults, total });
  } catch (err) {
    console.error("Error generating Podravka Facings Report:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getPodravkaPresenceReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1. Get Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // New: Get Category Parameter
    // We handle it as an array to allow selecting multiple categories if needed,
    // or just a single string.
    let categories: string[] = [];
    if (req.query.category) {
      categories = Array.isArray(req.query.category)
        ? (req.query.category as string[])
        : [req.query.category as string];
    }

    // Handle storeType
    let storeTypes: string[] = [];
    if (req.query.storeType) {
      storeTypes = Array.isArray(req.query.storeType)
        ? (req.query.storeType as string[])
        : [req.query.storeType as string];
    }

    // 2. Fetch Stores (Existing Logic)
    let nameConditions: string[] = [];
    if (storeTypes.length === 0) {
      nameConditions.push("store_name LIKE '%VFS%'");
      nameConditions.push("store_name LIKE '%PROEX%'");
    } else {
      if (storeTypes.includes("VFS"))
        nameConditions.push("store_name LIKE '%VFS%'");
      if (storeTypes.includes("PROEX"))
        nameConditions.push("store_name LIKE '%PROEX%'");
    }

    const whereClause =
      nameConditions.length > 0
        ? `(${nameConditions.join(" OR ")})`
        : `(store_name LIKE '%VFS%' OR store_name LIKE '%PROEX%')`;

    const storeQuery = `
      SELECT store_id, store_name, store_code, store_category
      FROM stores
      WHERE ${whereClause}
      ORDER BY store_name ASC
    `;

    const [stores] = await db.promise().query<RowDataPacket[]>(storeQuery);

    if (stores.length === 0) {
      res.json({
        stores: [],
        products: [],
        data: {},
        pagination: { totalProducts: 0 },
      });
      return;
    }

    const storeIds = stores.map((s) => s.store_id);
    const storePlaceholders = storeIds.map(() => "?").join(",");

    // 3. Fetch Latest Batches (Existing Logic)
    const latestBatchQuery = `
      SELECT pf.store_id, pf.batch_id, pf.created_at
      FROM podravka_facings pf
      JOIN (
        SELECT store_id, MAX(created_at) AS max_created_at
        FROM podravka_facings
        WHERE record_type = 'PRESENCE'
          AND store_id IN (${storePlaceholders})
        GROUP BY store_id
      ) lb ON pf.store_id = lb.store_id AND pf.created_at = lb.max_created_at
      WHERE pf.record_type = 'PRESENCE'
      GROUP BY pf.store_id, pf.batch_id, pf.created_at
    `;

    const [latestBatches] = await db
      .promise()
      .query<RowDataPacket[]>(latestBatchQuery, storeIds);

    const latestBatchByStore = new Map<number, string>();
    latestBatches.forEach((row) => {
      if (!latestBatchByStore.has(row.store_id)) {
        latestBatchByStore.set(row.store_id, row.batch_id);
      }
    });

    // 4. Fetch Paginated Products (UPDATED with Category Filter)

    // Base queries
    let productQuery = `
      SELECT product_id, name, category, product_category, business_unit, podravka_code, elkos_code
      FROM podravka_products
    `;
    let countQuery = "SELECT COUNT(*) as total FROM podravka_products";
    const queryParams: any[] = [];

    // Apply Category Filter if present
    if (categories.length > 0) {
      const categoryPlaceholders = categories.map(() => "?").join(",");
      const whereCategory = `WHERE category IN (${categoryPlaceholders})`;

      productQuery += ` ${whereCategory}`;
      countQuery += ` ${whereCategory}`;

      // Add categories to params for both count and select
      categories.forEach((c) => queryParams.push(c));
    }

    // Add Ordering and Pagination to product query
    productQuery += " ORDER BY name ASC LIMIT ? OFFSET ?";

    // We need separate params array for the main query because it includes limit/offset
    const productQueryParams = [...queryParams, limit, offset];

    // Get Total Count (Filtered)
    const [[{ total }]] = await db
      .promise()
      .query<RowDataPacket[]>(countQuery, queryParams);

    // Get Products (Filtered & Paginated)
    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(productQuery, productQueryParams);

    // 5. Fetch Presence Data (Existing Logic)
    let presenceRows: RowDataPacket[] = [];
    if (latestBatchByStore.size && products.length > 0) {
      const batchIds = Array.from(latestBatchByStore.values());
      const productIds = products.map((p) => p.product_id);

      const [rows] = await db.promise().query<RowDataPacket[]>(
        `SELECT store_id, product_id, facings_count, is_listed
         FROM podravka_facings
         WHERE record_type = 'PRESENCE'
           AND batch_id IN (${batchIds.map(() => "?").join(",")})
           AND product_id IN (${productIds.map(() => "?").join(",")})`,
        [...batchIds, ...productIds]
      );
      presenceRows = rows;
    }

    const presenceMap = new Map<string, RowDataPacket>();
    for (const row of presenceRows) {
      presenceMap.set(`${row.store_id}:${row.product_id}`, row);
    }

    // 6. Build Matrix (Existing Logic)
    const data: Record<string, Record<string, string>> = {};

    for (const product of products) {
      const row: Record<string, string> = {};
      for (const store of stores) {
        const batchId = latestBatchByStore.get(store.store_id);

        if (!batchId) {
          row[store.store_id] = "Not Yet Recorded";
          continue;
        }

        const key = `${store.store_id}:${product.product_id}`;
        const presence = presenceMap.get(key);

        if (!presence) {
          row[store.store_id] = "Not listed";
          continue;
        }

        const listed =
          presence.is_listed != null
            ? Boolean(presence.is_listed)
            : presence.facings_count === 1;
        row[store.store_id] = listed ? "Listed" : "Not listed";
      }
      data[product.product_id] = row;
    }

    res.json({
      stores,
      products,
      data,
      pagination: {
        totalProducts: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: products.length,
      },
    });
  } catch (err) {
    console.error("Error generating Podravka Presence Report:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const batchCreatePodravkaFacings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const facings = req.body;

    if (!user_id) {
      res.status(401).json({
        error: "Nuk jeni te autoreziaur.",
      });
      return;
    }

    if (!Array.isArray(facings) || facings.length === 0) {
      res.status(400).json({ error: "Facings array is required!" });
      return;
    }
    const batchId = uuidv4();

    for (const facing of facings) {
      const {
        user_id: payloadUserId,
        store_id,
        product_id,
        category,
        facings_count,
        is_listed = true,
        record_type = "FACINGS",
      } = facing;
      if (payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to submit facings for another user.",
        });
        return;
      }

      const [storeRows] = await db
        .promise()
        .query<RowDataPacket[]>("SELECT * FROM stores WHERE store_id = ?", [
          store_id,
        ]);

      if (storeRows.length === 0) {
        res.status(404).json({ error: "Shitorja nuk ekziston" });
        return;
      }

      if (
        !user_id ||
        !store_id ||
        !product_id ||
        !category ||
        facings_count == null
      ) {
        res
          .status(400)
          .json({ error: "Each facing must have all fields filled!" });
        return;
      }

      if (record_type === "PRESENCE") {
        if (facings_count !== 0 && facings_count !== 1) {
          res.status(400).json({
            error: "Presence entries must have facings_count of 0 or 1.",
          });
          return;
        }
        facing.is_listed = facings_count === 1;
      } else if (record_type !== "FACINGS") {
        res.status(400).json({ error: "Invalid record_type." });
        return;
      }
    }

    const values = facings.map((f) => [
      f.user_id,
      f.store_id,
      f.product_id,
      f.category,
      f.facings_count,
      batchId,
      f.is_listed ?? true,
      f.record_type ?? "FACINGS",
    ]);

    const query =
      "INSERT INTO podravka_facings (user_id, store_id, product_id, category, facings_count, batch_id, is_listed, record_type) VALUES ?";

    const [result] = await db.promise().query<OkPacket>(query, [values]);

    res.status(201).json({
      affectedRows: result.affectedRows,
      message: "Podravka facings batch added successfully!",
    });
  } catch (error) {
    console.error("Error batch adding Podravka facings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePodravkaFacingsBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const facings = req.body?.facings;
    const batchId = req.body?.batchId;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur." });
      return;
    }

    if (!batchId || !Array.isArray(facings) || facings.length === 0) {
      res
        .status(400)
        .json({ error: "batchId and facings array are required!" });
      return;
    }

    for (const facing of facings) {
      const { user_id: payloadUserId, product_id, facings_count } = facing;

      if (payloadUserId !== user_id) {
        res.status(403).json({
          error: "You are not authorized to update facings for another user.",
        });
        return;
      }

      if (!product_id || facings_count == null) {
        res.status(400).json({
          error: "Each facing must have product_id and facings_count!",
        });
        return;
      }
    }

    const connection = await db.promise().getConnection();
    try {
      await connection.beginTransaction();

      const CHUNK_SIZE = 200;
      for (let i = 0; i < facings.length; i += CHUNK_SIZE) {
        const chunk = facings.slice(i, i + CHUNK_SIZE);
        const productIds = chunk.map((f) => f.product_id);

        const facingsCase = chunk
          .map(() => "WHEN ? THEN ?")
          .join(" ");
        const listedCase = chunk
          .map(() => "WHEN ? THEN ?")
          .join(" ");

        const query = `
          UPDATE podravka_facings
          SET 
            facings_count = CASE product_id ${facingsCase} ELSE facings_count END,
            is_listed = CASE 
              WHEN record_type = 'PRESENCE' THEN CASE product_id ${listedCase} ELSE is_listed END
              ELSE is_listed 
            END
          WHERE batch_id = ?
            AND user_id = ?
            AND product_id IN (${productIds.map(() => "?").join(",")})
        `;

        const params: any[] = [];
        chunk.forEach((f) => {
          params.push(f.product_id, f.facings_count);
        });
        chunk.forEach((f) => {
          params.push(f.product_id, f.facings_count === 1);
        });
        params.push(batchId, user_id, ...productIds);

        await connection.query(query, params);
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    res.status(200).json({
      message: "Facings u perditsuan me sukses!",
    });
  } catch (error) {
    console.error("Error updating facings batch:", error);
    res.status(500).json({ error: "Error ne server" });
  }
};

export const deletePodravkaFacingBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const batchId = req.params.batchId;

    if (!user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur." });
      return;
    }

    if (!batchId) {
      res.status(400).json({ error: "Batch ID is required." });
      return;
    }

    const query = `
      DELETE FROM podravka_facings 
      WHERE batch_id = ? AND user_id = ?`;

    const [result] = await db
      .promise()
      .query<OkPacket>(query, [batchId, user_id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.status(200).json({ message: "Facings batch deleted successfully!" });
  } catch (error) {
    console.error("Error deleting facings batch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPodravkaFacingsByBatchId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user_id = req.user?.user_id;

    if (!batchId) {
      res.status(400).json({ error: "Batch ID is required." });
      return;
    }

    const query = `
    SELECT 
      pf.*,
      u.user AS user,
      s.store_name,
      s.store_code,
      s.store_category,
      p.name AS name
    FROM podravka_facings pf
    JOIN users u ON pf.user_id = u.user_id
    JOIN stores s ON pf.store_id = s.store_id
    JOIN podravka_products p ON pf.product_id = p.product_id
    WHERE pf.batch_id = ?
    `;

    const [results] = await db
      .promise()
      .query<RowDataPacket[]>(query, [batchId, user_id]);

    if (results.length === 0) {
      res.status(404).json({ error: "No facings found for this batch ID." });
      return;
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching facings by batch ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPodravkaPresenceByBatchId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      res.status(400).json({ error: "Batch ID is required." });
      return;
    }

    const storeQuery = `
      SELECT 
        s.store_id,
        s.store_name,
        s.store_code,
        s.store_category,
        pf.user_id,
        pf.batch_id,
        MAX(pf.created_at) AS created_at
      FROM podravka_facings pf
      JOIN stores s ON pf.store_id = s.store_id
      WHERE pf.batch_id = ?
        AND pf.record_type = 'PRESENCE'
      GROUP BY s.store_id, s.store_name, s.store_code, s.store_category, pf.user_id, pf.batch_id
    `;

    const [storeRows] = await db
      .promise()
      .query<RowDataPacket[]>(storeQuery, [batchId]);

    if (storeRows.length === 0) {
      res.status(404).json({ error: "No presence found for this batch ID." });
      return;
    }

    const itemsQuery = `
      SELECT 
        pf.podravka_facings_id,
        pf.product_id,
        pf.category,
        pf.facings_count,
        pf.is_listed,
        pf.record_type,
        p.name AS name
      FROM podravka_facings pf
      JOIN podravka_products p ON pf.product_id = p.product_id
      WHERE pf.batch_id = ?
        AND pf.record_type = 'PRESENCE'
      ORDER BY p.name ASC
    `;

    const [items] = await db
      .promise()
      .query<RowDataPacket[]>(itemsQuery, [batchId]);

    res.json({
      store: storeRows[0],
      items,
    });
  } catch (error) {
    console.error("Error fetching presence by batch ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
