import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../models/db";
import { RowDataPacket } from "mysql2";
const logger = require("./logger");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

interface AuthenticatedRequest extends Request {
  token?: string;
  user?: any;
}

const middleware = {
  requestLogger: (request: Request, response: Response, next: NextFunction) => {
    logger.info("Method:", request.method);
    logger.info("Path:  ", request.path);
    logger.info("Body:  ", request.body);
    next();
  },

  errorHandler: (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    console.error(err);

    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON" });
    } else if (err instanceof Error) {
      res.status(422).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  unknownEndpoint: (req: Request, res: Response) => {
    res.status(404).send({ error: "Unknown endpoint" });
  },

  tokenExtractor: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    let authHeader = req.headers.authorization || req.headers.Authorization;

    if (Array.isArray(authHeader)) {
      authHeader = authHeader[0];
    }
    if (
      !authHeader ||
      typeof authHeader !== "string" ||
      !authHeader.startsWith("Bearer ")
    ) {
      res.status(401).json({ error: "Access Denied: No Token Provided" });
      return;
    }

    req.token = authHeader.split(" ")[1];
    next();
  },

  authenticateToken: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.token) {
      res.status(401).json({ error: "Unauthorized: No Token Found" });
      return;
    }

    try {
      const decodedToken = jwt.verify(req.token, JWT_SECRET) as {
        user_id: number;
        role: string;
      };
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Token verification failed:", error);

      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: "Token expired, please log in again" });
        return;
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(403).json({ error: "Invalid token, authentication failed" });
        return;
      }

      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  userExtractor: async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user || !req.user.user_id) {
      res.status(401).json({ error: "Unauthorized: No valid user found" });
    }

    try {
      const query = "SELECT user_id, user, role FROM users WHERE user_id = ?";
      const [rows] = await db
        .promise()
        .query<RowDataPacket[]>(query, [req.user.user_id]);

      if (rows.length === 0) {
        res.status(404).json({ error: "User not found!" });
      }

      req.user = rows[0];
      next();
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  authorizeRole: (roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        res
          .status(403)
          .json({ error: "Access denied: insufficient permissions" });
        return;
      }
      next();
    };
  },
};

export default middleware;
