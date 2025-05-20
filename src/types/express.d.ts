import { Request } from "express";

declare module "express" {
  export interface Request {
    token?: string;
    user?: {
      user_id: number;
      user: string;
      role: string;
    };
  }
}
