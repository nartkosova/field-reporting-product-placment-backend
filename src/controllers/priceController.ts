import { Request, Response } from "express";
import { OkPacket } from "mysql2";
import db from "../models/db";

export const batchCreatePriceCheck = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const prices = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      res.status(400).json({ error: "Prices array is required!" });
      return;
    }

    for (const price of prices) {
      const {
        user_id,
        store_id,
        category,
        product_type,
        podravka_product_id,
        competitor_id,
        regular_price,
        deal_price,
        discount_description,
      } = price;

      const validType =
        product_type === "podravka" || product_type === "competitor";
      const hasValidProduct =
        (product_type === "podravka" && podravka_product_id) ||
        (product_type === "competitor" && competitor_id);

      if (
        !user_id ||
        !store_id ||
        !category ||
        !validType ||
        !hasValidProduct ||
        regular_price == null
      ) {
        res.status(400).json({
          error:
            "Each price entry must have user_id, store_id, category, product_type, and regular_price, and valid product ID",
        });
        return;
      }
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
