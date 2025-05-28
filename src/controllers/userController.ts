import { Request, Response } from "express";
import db from "../models/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user, password, role } = req.body;
    if (!user || !password) {
      res.status(400).json({
        error: "Mbush te gjitha fushat e nevojshme: user, password dhe role",
      });
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Fjalkalimi duhet te jet 8 shkronja" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO users (user, password, role) VALUES (?, ?, ?)";

    db.query<OkPacket>(
      query,
      [user, hashedPassword, role],
      (err: QueryError | null, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          id: result.insertId,
          message: "User i ri u krijua me sukses",
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Error ne server" });
  }
};
export const getUsers = (req: Request, res: Response): void => {
  const query = "SELECT user, user_id FROM users";

  db.query<RowDataPacket[]>(query, (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};
export const loginUser = (req: Request, res: Response): void => {
  const { user, password } = req.body;

  const query = "SELECT * FROM users WHERE user = ?";
  db.query(query, [user], (err, results: any) => {
    console.error("Results:", err);
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0)
      return res.status(401).json({ error: "Fjalkalimi esht gabim" });

    const user = results[0];

    bcrypt.compare(password, user.password, (bcryptErr, isMatch) => {
      if (bcryptErr)
        return res.status(500).json({ error: "Error comparing passwords" });
      if (!isMatch)
        return res.status(401).json({ error: "Fjalkalimi esht gabim" });

      const token = jwt.sign(
        { user_id: user.user_id, user: user.user, role: user.role },
        JWT_SECRET
      );

      res.json({
        token,
        user: { id: user.user_id, user: user.user, role: user.role },
      });
    });
  });
};

export const updateUserPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { newPassword } = req.body;
    const user_id = req.user?.user_id;
    if ("user_id" in req.body) {
      res
        .status(403)
        .json({ error: "Manual user_id assignment is not allowed" });
      return;
    }
    if (!user_id || !newPassword) {
      res.status(400).json({ error: "User ID and new password are required" }); //update
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "Fjalkalimi duhet te jet 8 shkronja" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const query = "UPDATE users SET password = ? WHERE user_id = ?";
    db.query<OkPacket>(query, [hashedPassword, user_id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.affectedRows === 0) {
        res.status(404).json({ error: "User not found" });
      } else {
        res.json({ message: "Fjalkalimi u perditsua me sukses" });
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error ne server" });
  }
};
