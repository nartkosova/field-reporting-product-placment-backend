import { Request, Response } from "express";
import { OkPacket } from "mysql2";
import db from "../models/db";

export const batchCreatePriceCheck = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user_id = req.user?.user_id;
    const prices = req.body;

    if (!user_id) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    if (!Array.isArray(prices) || prices.length === 0) {
      res.status(400).json({ error: "Prices array is required!" });
      return;
    }

    for (const price of prices) {
      const {
        user_id: payloadUserId,
        store_id,
        category,
        product_type,
        podravka_product_id,
        competitor_id,
        regular_price,
      } = price;

      if (payloadUserId !== undefined && payloadUserId !== user_id) {
        res.status(403).json({
          error:
            "You are not authorized to submit price data for another user.",
        });
        return;
      }

      const validType =
        product_type === "podravka" || product_type === "competitor";

      const hasValidProduct =
        (product_type === "podravka" && podravka_product_id) ||
        (product_type === "competitor" && competitor_id);

      if (
        !store_id ||
        !category ||
        !validType ||
        !hasValidProduct ||
        regular_price == null
      ) {
        res.status(400).json({
          error:
            "Each price entry must include store_id, category, valid product_type, and product ID, and regular_price",
        });
        return;
      }

      // enforce user_id to prevent tampering
      price.user_id = user_id;
    }

    const values = prices.map((p) => [
      p.user_id,
      p.store_id,
      p.category,
      p.product_type,
      p.podravka_product_id ?? null,
      p.competitor_id ?? null,
      p.regular_price,
      p.deal_price ?? null,
      p.discount_description ?? null,
    ]);

    const query = `
      INSERT INTO price_checker 
        (user_id, store_id, category, product_type, podravka_product_id, competitor_id, regular_price, deal_price, discount_description)
      VALUES ?
    `;

    const [result] = await db.promise().query<OkPacket>(query, [values]);

    res.status(201).json({
      affectedRows: result.affectedRows,
      message: "Price check batch inserted successfully!",
    });
  } catch (error) {
    console.error("Error batch inserting price check:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPriceCheck = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { store_id, category, product_type } = req.query;
    let query = `SELECT * FROM price_checker`;
    const params: any[] = [];

    if (store_id) {
      query += ` WHERE store_id = ?`;
      params.push(store_id);
    }

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (product_type) {
      query += ` AND product_type = ?`;
      params.push(product_type);
    }

    const [results] = await db.promise().query(query, params);

    res.json(results);
  } catch (error) {
    console.error("Error fetching price check:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
