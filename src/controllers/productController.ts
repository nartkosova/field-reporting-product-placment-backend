import { Request, Response } from 'express';
import db from '../models/db';
import { QueryError, RowDataPacket, OkPacket } from 'mysql2';

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, name, podravka_code, elkos_code, product_category } = req.body;
    
    if (!category || !name || !podravka_code || !product_category) {
      res.status(400).json({ error: 'All required fields must be provided!' });
      return;
    }

    const query = 'INSERT INTO podravka_products (category, name, podravka_code, elkos_code, product_category) VALUES (?, ?, ?, ?, ?)';
    const [result] = await db.promise().query<OkPacket>(query, [category, name, podravka_code, elkos_code, product_category]);
    
    res.status(201).json({ id: result.insertId, message: 'Product added successfully!' });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    let query = 'SELECT * FROM podravka_products';
    const queryParams: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      queryParams.push(category);
    }

    const [products] = await db.promise().query<RowDataPacket[]>(query, queryParams);

    if (products.length === 0) {
      res.status(404).json({ error: 'No products found' });
      return;
    }

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


