import { Request, Response } from "express";
import db from "../models/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";
import dotenv from "dotenv";
import { get } from "http";
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
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Fjalkalimi duhet te jet 8 shkronja" });
      return;
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
        return;
      }
    );
  } catch (error) {
    res.status(500).json({ error: "Error ne server" });
  }
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user, password, role } = req.body;
    const targetUserId = req.params.user_id;

    if (!targetUserId || !user || !password || !role) {
      res.status(400).json({
        error: "User, password dhe role jane të nevojshme",
      });
      return;
    }

    if (password.length < 8) {
      res
        .status(400)
        .json({ error: "Fjalëkalimi duhet të jetë së paku 8 shkronja" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const query =
      "UPDATE users SET user = ?, password = ?, role = ? WHERE user_id = ?";
    db.query<OkPacket>(
      query,
      [user, hashedPassword, role, targetUserId],
      (err: QueryError | null, result) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (result.affectedRows === 0) {
          res.status(404).json({ error: "Përdoruesi nuk u gjet" });
          return;
        }
        res.json({ message: "Përdoruesi u përditësua me sukses" });
      }
    );
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Gabim në server" });
  }
};

export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user_id = req.params.user_id;
  if (!user_id) {
    res.status(400).json({ error: "User ID eshte i nevojshem" });
    return;
  }
  const query = "SELECT user, user_id, role FROM users WHERE user_id = ?";
  db.query<RowDataPacket[]>(
    query,
    [user_id],
    (err: QueryError | null, results) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (results.length === 0) {
        res.status(404).json({ error: "User nuk egziston" });
        return;
      }
      res.json(results[0]);
    }
  );
};

export const getUsers = (req: Request, res: Response): void => {
  const query = "SELECT user_id, user, created_at FROM users ORDER BY user ASC";

  db.query<RowDataPacket[]>(query, (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
    return;
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

export const deleteUser = (req: Request, res: Response): void => {
  const targetUserId = Number(req.params.user_id);
  const loggedInUserId = req.user?.user_id;

  if (!targetUserId) {
    res.status(400).json({ error: "User ID është i nevojshëm" });
    return;
  }

  if (targetUserId === loggedInUserId) {
    res.status(403).json({
      error: "Nuk mund të fshini llogarinë tuaj ndërkohë që jeni të kyçur",
    });
    return;
  }

  const query = "DELETE FROM users WHERE user_id = ?";
  db.query<OkPacket>(query, [targetUserId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Përdoruesi nuk u gjet" });
    } else {
      res.json({ message: "Përdoruesi u fshi me sukses" });
    }
  });
};
