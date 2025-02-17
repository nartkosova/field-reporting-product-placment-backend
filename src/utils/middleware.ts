// backend/utils/middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
const logger = require("./logger");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

interface AuthenticatedRequest extends Request {
  token?: string;
  user?: any;
}

const middleware = {
  requestLogger: (request: Request, response: Response, next: NextFunction) => {
    logger.info("Method:", request.method);
    logger.info("Path:  ", request.path);
    logger.info("Body:  ", request.body);
    logger.info("---");
    next();
  },
  errorHandler: (err: Error, req: Request, res: Response, next: NextFunction): void => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  },
  unknownEndpoint: (req: Request, res: Response) => {
    res.status(404).send({ error: "Unknown endpoint" });
  },
  tokenExtractor: (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access Denied: No Token Provided' });
      return;
    }
    req.token = authHeader.split(' ')[1];
    console.log("The token is ", req.token)
    next();
  },

  authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.token) {
      res.status(401).json({ error: 'Unauthorized: No Token Found' });
      return;
    }
    
    jwt.verify(req.token, JWT_SECRET, (err, user) => {
      if (err) {
        res.status(403).json({ error: 'Forbidden: Invalid Token' });
        return;
      }
      req.user = user;
      next();
    });
  }
};

export default middleware;
