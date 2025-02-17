import { Request, Response } from 'express';
import db from '../models/db';
import { QueryError, RowDataPacket, OkPacket } from 'mysql2';

export const createStore = (req: Request, res: Response): void => {
  const { store_name, store_code, store_category, location, municipality } = req.body;
  const query = 'INSERT INTO stores (store_name, store_code, store_category, location, municipality) VALUES (?, ?, ?, ?, ?)';
  
  db.query<OkPacket>(query, [store_name, store_code, store_category, location, municipality], (err: QueryError | null, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: result.insertId });
  });
};

export const getStores = (req: Request, res: Response): void => {
  db.query<RowDataPacket[]>('SELECT * FROM stores', (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

export const getStoreById = (req: Request, res: Response): void => {
  const { id } = req.params;
  db.query<RowDataPacket[]>('SELECT * FROM stores WHERE store_id = ?', [id], (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Store not found' });
    res.json(results[0]);
  });
};

export const updateStore = (req: Request, res: Response): void => {
  const { id } = req.params;
  const { store_name, store_code, store_category, location, municipality } = req.body;
  const query = 'UPDATE stores SET store_name = ?, store_code = ?, store_category = ?, location = ?, municipality = ? WHERE store_id = ?';
  
  db.query<OkPacket>(query, [store_name, store_code, store_category, location, municipality, id], (err: QueryError | null) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Store updated successfully' });
  });
};

export const deleteStore = (req: Request, res: Response): void => {
  const { id } = req.params;
  db.query<OkPacket>('DELETE FROM stores WHERE store_id = ?', [id], (err: QueryError | null) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: 'Store deleted successfully' });
  });
};