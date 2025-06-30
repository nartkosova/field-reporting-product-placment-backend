import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import logger from "./utils/logger";
import middleware from "./utils/middleware";
import { generalLimiter } from "./utils/rateLimiter";
import { helmetConfig } from "./utils/helmetConfig";

import userRoutes from "./routes/userRoutes";
import storeRoutes from "./routes/storeRoutes";
import productRoutes from "./routes/productRoutes";
import competitorFacingsRoutes from "./routes/facings_routes/competitorFacingRoutes";
import podravkaFacingsRoutes from "./routes/facings_routes/podravkaFacingRoutes";
import competitorRoutes from "./routes/competitorRoutes";
import priceRoutes from "./routes/priceRoutes";
import photoRoutes from "./routes/photoRoutes";
import llmRoutes from "./routes/llmRoutes";
import path from "path";
import geminiRoutes from "./routes/geminiRoutes";
const app = express();

// Security middleware
app.use(helmetConfig);
app.use(cors());
app.use(bodyParser.json());
app.use(logger);
app.use(generalLimiter);

app.use("/api/users", userRoutes);
app.use(
  "/api/stores",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  storeRoutes
);
app.use(
  "/api/products",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.rejectManualUserId,
  productRoutes
);
app.use(
  "/api/facings",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.rejectManualUserId,
  competitorFacingsRoutes,
  podravkaFacingsRoutes
);
app.use(
  "/api/competitor-brands",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.rejectManualUserId,
  competitorRoutes
);
app.use(
  "/api/price-checks",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.rejectManualUserId,
  priceRoutes
);
app.use(
  "/api/photos",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.rejectManualUserId,
  photoRoutes
);
app.use(
  "/api/ai",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  llmRoutes
);

app.use(
  "/api/gemini",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  middleware.authorizeRole(["admin", "employee"]),
  geminiRoutes
);
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);
module.exports = app;
