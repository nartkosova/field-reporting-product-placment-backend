import { Request, Response } from 'express';
import db from '../models/db';
import { QueryError, RowDataPacket, OkPacket } from 'mysql2';

export const createReport = (req: Request, res: Response): void => {
  const { user_id, store_id, store_name, report_date, podravka_facing_percentage, notes } = req.body;
  const query = 'INSERT INTO reports (user_id, store_id, store_name, report_date, podravka_facing_percentage, notes) VALUES (?, ?, ?, ?, ?, ?)';
  
  db.query<OkPacket>(query, [user_id, store_id, store_name, report_date, podravka_facing_percentage, notes], (err: QueryError | null, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: result.insertId });
  });
};

export const getReports = (req: Request, res: Response): void => {
  const { startDate, endDate } = req.query;
  let query = 'SELECT * FROM reports';
  const params: any[] = [];

  if (startDate && endDate) {
    query += ' WHERE report_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  db.query<RowDataPacket[]>(query, params, (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
