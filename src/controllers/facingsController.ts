import { Request, Response } from 'express';
import db from '../models/db';
import { OkPacket } from 'mysql2';

export const createPodravkaFacing = async (req: Request, res: Response): Promise<void> => {
    try {
      const { user_id, store_id, product_id, facings_count, report_date } = req.body;
      if (!user_id || !store_id || !product_id || !facings_count || !report_date) {
        res.status(400).json({ error: 'All fields are required!' });
        return;
      }
      const query = 'INSERT INTO podravka_facings (user_id, store_id, product_id, facings_count, report_date) VALUES (?, ?, ?, ?, ?)';
      const [result] = await db.promise().query<OkPacket>(query, [user_id, store_id, product_id, facings_count, report_date]);
      res.status(201).json({ id: result.insertId, message: 'Podravka facing added successfully!' });
    } catch (error) {
      console.error('Error adding Podravka facing:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
export const createCompetitorFacing = async (req: Request, res: Response) => {
  try {
    const { user_id, store_id, competitor_name, facings_count, report_date } = req.body;
    if (!user_id || !store_id || !competitor_name || !facings_count || !report_date) {
      res.status(400).json({ error: 'All fields are required!' });
      return 
    }
    const query = 'INSERT INTO competitor_facings (user_id, store_id, competitor_name, facings_count, report_date) VALUES (?, ?, ?, ?, ?)';
    const [result] = await db.promise().query<OkPacket>(query, [user_id, store_id, competitor_name, facings_count, report_date]);
    res.status(201).json({ id: result.insertId, message: 'Competitor facing added successfully!' });
  } catch (error) {
    console.error('Error adding competitor facing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
