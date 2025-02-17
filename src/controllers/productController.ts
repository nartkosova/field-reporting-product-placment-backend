import { Request, Response } from 'express';
import db from '../models/db';
import { QueryError, RowDataPacket, OkPacket } from 'mysql2';

export const createProduct = (req: Request, res: Response): void => {
  const { category, name, podravka_code, ekos_code, product_category } = req.body;
  const query = 'INSERT INTO podravka_products (category, name, podravka_code, ekos_code, product_category) VALUES (?, ?, ?, ?, ?)';
  
  db.query<OkPacket>(query, [category, name, podravka_code, ekos_code, product_category], (err: QueryError | null, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: result.insertId });
  });
};

export const getProducts = (req: Request, res: Response): void => {
  db.query<RowDataPacket[]>('SELECT * FROM podravka_products', (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
