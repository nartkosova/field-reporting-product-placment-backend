import { Request, Response } from "express";
import db from "../models/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { QueryError, RowDataPacket, OkPacket } from "mysql2";
import dotenv from "dotenv";
import {
  clearSessionCookie,
  setSessionCookie,
  validatePassword,
} from "../utils/auth";
import { ASSIGNABLE_ROLES } from "../utils/permissions";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Refusing to start.");
}

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
const ALLOWED_ROLES = new Set(["admin", "employee", "viewer"]);

const isAdminRequest = (req: Request): boolean => req.user?.role === "admin";

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: "Access denied: insufficient permissions" });
      return;
    }

    const { user, password, role } = req.body;
    if (!user || !password || !role) {
      res.status(400).json({
        error: "Mbush te gjitha fushat e nevojshme: user, password dhe role",
      });
      return;
    }
    if (!ALLOWED_ROLES.has(String(role))) {
      res.status(400).json({ error: "Roli i pavlefshëm" });
      return;
    }
    const passwordError = validatePassword(password, user);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 12);

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
    if (!isAdminRequest(req)) {
      res.status(403).json({ error: "Access denied: insufficient permissions" });
      return;
    }

    const { user, password, role } = req.body;
    const targetUserId = req.params.user_id;

    if (!targetUserId || !user || !password || !role) {
      res.status(400).json({
        error: "User, password dhe role jane të nevojshme",
      });
      return;
    }
    if (!ALLOWED_ROLES.has(String(role))) {
      res.status(400).json({ error: "Roli i pavlefshëm" });
      return;
    }

    const passwordError = validatePassword(password, user);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

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
  if (!isAdminRequest(req)) {
    res.status(403).json({ error: "Access denied: insufficient permissions" });
    return;
  }

  const user_id = req.params.user_id;
  if (!user_id) {
    res.status(400).json({ error: "User ID eshte i nevojshem" });
    return;
  }
  const query =
    "SELECT user, user_id, role, field_access FROM users WHERE user_id = ?";
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

// Everyone who can hold markets, which includes admins: they can be assigned
// markets like anyone else and show up in the report filters.
export const getEmployees = (req: Request, res: Response): void => {
  const query = `
        SELECT user_id, user, role, created_at
        FROM users
        WHERE role IN (?)
        ORDER BY user ASC
      `;

  db.query<RowDataPacket[]>(
    query,
    [ASSIGNABLE_ROLES],
    (err: QueryError | null, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
      return;
    }
  );
};

export const updateUserFieldAccess = (req: Request, res: Response): void => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ error: "Access denied: insufficient permissions" });
    return;
  }

  const { field_access } = req.body;
  if (typeof field_access !== "boolean") {
    res.status(400).json({ error: "field_access duhet të jetë true ose false" });
    return;
  }

  // Employees work in the field by default, so the flag only means something
  // on an admin.
  const query =
    "UPDATE users SET field_access = ? WHERE user_id = ? AND role = 'admin'";
  db.query<OkPacket>(
    query,
    [field_access, req.params.user_id],
    (err: QueryError | null, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (result.affectedRows === 0) {
        res.status(404).json({ error: "Administratori nuk u gjet" });
        return;
      }
      res.json({ message: "Qasja në terren u përditësua me sukses" });
    }
  );
};
export const getAllUsers = (req: Request, res: Response): void => {
  if (!isAdminRequest(req)) {
    res.status(403).json({ error: "Access denied: insufficient permissions" });
    return;
  }

  const query =
    "SELECT user_id, user, role, created_at FROM users ORDER BY user ASC";

  db.query<RowDataPacket[]>(query, (err: QueryError | null, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
    return;
  });
};
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
// Compared against when the user does not exist, so a wrong username takes as
// long as a wrong password and does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { user, password } = req.body;

  // mysql2 expands objects/arrays into SQL fragments, so only accept strings.
  if (typeof user !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "User dhe fjalkalimi jane te nevojshem" });
    return;
  }

  try {
    const [rows] = await db
      .promise()
      .query<RowDataPacket[]>(
        `SELECT user_id, user, role, field_access, password, failed_login_attempts,
                locked_until > CURRENT_TIMESTAMP AS is_locked
         FROM users WHERE user = ? LIMIT 1`,
        [user]
      );
    const account = rows[0];

    if (account?.is_locked) {
      res.status(429).json({
        error: `Llogaria është bllokuar përkohësisht pas shumë tentimeve. Provo pas ${LOCKOUT_MINUTES} minutash.`,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, account?.password || DUMMY_HASH);

    if (!account || !isMatch) {
      if (account) {
        // MySQL applies SET left to right: decide the lock from the old
        // counter, then reset the counter so it restarts after the lock.
        await db.promise().execute(
          `UPDATE users
           SET locked_until = IF(failed_login_attempts + 1 >= ?,
                                 CURRENT_TIMESTAMP + INTERVAL ? MINUTE, NULL),
               failed_login_attempts = IF(failed_login_attempts + 1 >= ?,
                                          0, failed_login_attempts + 1)
           WHERE user_id = ?`,
          [MAX_FAILED_LOGINS, LOCKOUT_MINUTES, MAX_FAILED_LOGINS, account.user_id]
        );
      }
      res.status(401).json({ error: "Përdoruesi ose fjalëkalimi është gabim" });
      return;
    }

    if (account.failed_login_attempts) {
      await db
        .promise()
        .execute(
          "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?",
          [account.user_id]
        );
    }

    const token = jwt.sign(
      { user_id: account.user_id, user: account.user, role: account.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN } as jwt.SignOptions
    );
    const { exp } = jwt.decode(token) as { exp: number };
    setSessionCookie(req, res, token, exp * 1000 - Date.now());

    // The token itself only lives in the httpOnly cookie. The client gets
    // the non-secret profile so it can render the UI and know when to re-login.
    res.json({
      user: {
        user_id: account.user_id,
        user: account.user,
        role: account.role,
        field_access: Boolean(account.field_access),
      },
      expires_at: new Date(exp * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const logoutUser = (req: Request, res: Response): void => {
  clearSessionCookie(req, res);
  res.status(204).send();
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

    const passwordError = validatePassword(newPassword, req.user?.user);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

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
  if (!isAdminRequest(req)) {
    res.status(403).json({ error: "Access denied: insufficient permissions" });
    return;
  }

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
