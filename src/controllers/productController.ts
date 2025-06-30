import { Request, Response } from "express";
import db from "../models/db";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";

export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.query;

    let query = "SELECT product_id, name FROM podravka_products";
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
      res.status(404).json({ error: "Nuk ka produkte te konkurrences!" });
      return;
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching competitor products:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const getProductCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query =
      "SELECT DISTINCT category, business_unit FROM podravka_products";
    const [rows] = await db.promise().query<RowDataPacket[]>(query);

    if (rows.length === 0) {
      res.status(404).json({ error: "No product categories found" });
      return;
    }

    res.json(rows); // returns array of { category, business_unit }
  } catch (error) {
    console.error("Error fetching product categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProductByIdWithRanking = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;

    const productQuery = `
    SELECT 
      p.*,
      r.total_rank,
      r.category_rank,
      r.sales_last_year,
      r.category_sales_share,
      r.year
    FROM podravka_products p
    LEFT JOIN product_rankings r
      ON p.product_id = r.product_id
      AND r.year = (
        SELECT MAX(year)
        FROM product_rankings
        WHERE product_id = p.product_id
      )
    WHERE p.product_id = ?
  `;

    const [rows] = await db.promise().query(productQuery, [product_id]);

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(404).json({ error: "Produkti nuk u gjet." });
      return;
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching product with ranking:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getProductsByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.params;

    if (!category) {
      res
        .status(400)
        .json({ error: "Kategoria e produktit është e nevojshme" });
      return;
    }

    const query = `
      SELECT *
      FROM podravka_products
      WHERE category = ?
    `;

    const [products] = await db
      .promise()
      .query<RowDataPacket[]>(query, [category]);

    if (products.length === 0) {
      res.status(404).json({ error: "Nuk ka produkte në këtë kategori" });
      return;
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      category,
      name,
      podravka_code,
      elkos_code,
      product_category,
      weight,
      business_unit,
    } = req.body;

    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
      return;
    }

    if (!category || !name || !podravka_code || !product_category) {
      res.status(400).json({ error: "All required fields must be provided!" });
      return;
    }

    const query = `
      INSERT INTO podravka_products 
        (category, name, podravka_code, elkos_code, product_category, weight, business_unit) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db
      .promise()
      .query(query, [
        category,
        name,
        podravka_code,
        elkos_code,
        product_category,
        weight,
        business_unit,
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

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;
    const {
      category,
      name,
      podravka_code,
      elkos_code,
      product_category,
      weight,
      business_unit,
      total_rank,
      category_rank,
      sales_last_year,
      category_sales_share,
    } = req.body;

    if (!category || !name || !podravka_code || !product_category) {
      res
        .status(400)
        .json({ error: "Të gjitha fushat e nevojshme duhet të plotësohen!" });
      return;
    }

    const updateProductQuery = `
      UPDATE podravka_products
      SET category = ?, name = ?, podravka_code = ?, elkos_code = ?, product_category = ?, weight = ?, business_unit = ?
      WHERE product_id = ?
    `;

    const [productResult] = await db
      .promise()
      .query(updateProductQuery, [
        category,
        name,
        podravka_code,
        elkos_code,
        product_category,
        weight,
        business_unit,
        product_id,
      ]);

    if ((productResult as OkPacket).affectedRows === 0) {
      res.status(404).json({ error: "Produkti nuk u gjet" });
      return;
    }

    // Optional: Update ranking only if all three values are provided
    if (
      total_rank !== undefined &&
      category_rank !== undefined &&
      sales_last_year !== undefined
    ) {
      const updateRankingQuery = `
        UPDATE product_rankings
        SET total_rank = ?, category_rank = ?, sales_last_year = ?, category_sales_share = ?
        WHERE product_id = ? AND year = 2024
      `;

      const [rankingResult] = await db
        .promise()
        .query(updateRankingQuery, [
          total_rank,
          category_rank,
          sales_last_year,
          category_sales_share,
          product_id,
        ]);

      if ((rankingResult as OkPacket).affectedRows === 0) {
        // Optionally insert if it doesn't exist
        const insertRankingQuery = `
          INSERT INTO product_rankings (product_id, year, total_rank, category_rank, sales_last_year, category_sales_share)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await db
          .promise()
          .query(insertRankingQuery, [
            product_id,
            total_rank,
            category_rank,
            sales_last_year,
          ]);
      }
    }

    res.json({ message: "Produkti u përditësua me sukses" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      await conn.query("DELETE FROM product_rankings WHERE product_id = ?", [
        product_id,
      ]);
      await conn.query("DELETE FROM podravka_facings WHERE product_id = ?", [
        product_id,
      ]);
      // Add more deletions here if needed (e.g., price table, etc.)

      const [result] = await conn.query(
        "DELETE FROM podravka_products WHERE product_id = ?",
        [product_id]
      );

      await conn.commit();

      if ((result as OkPacket).affectedRows === 0) {
        res.status(404).json({ error: "Produkti nuk egziston" });
        return;
      }

      res.json({ message: "Produkti u fshi me sukses" });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.user_id) {
      res.status(401).json({ error: "Nuk jeni te autoreziaur" });
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

export const updateCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;
    const { name, category, weight } = req.body;
    if (!name || !category) {
      res.status(400).json({ error: "Emri dhe kategoria nevojiten" });
      return;
    }
    const query =
      "UPDATE competitor_products SET name = ?, category = ?, weight = ? WHERE competitor_product_id = ?";
    const [result] = await db
      .promise()
      .query<OkPacket>(query, [name, category, weight ?? null, product_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Produkti i konkurrences nuk egziston" });
      return;
    }
    res.json({ message: "Produkti i konkurrences u perditsua me sukses" });
  } catch (error) {
    console.error("Error updating competitor product:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteCompetitorProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_id } = req.params;
    const query =
      "DELETE FROM competitor_products WHERE competitor_product_id = ?";
    const [result] = await db.promise().query<OkPacket>(query, [product_id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Produkti i konkurrences nuk egziston" });
      return;
    }
    res.json({ message: "Produkti i konkurrences eshte fshire me sukses" });
  } catch (error) {
    console.error("Error deleting competitor product:", error);
    res.status(500).json({ error: "Server Error" });
  }
};
