import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import logger from "./utils/logger";
import middleware from "./utils/middleware";
import config from "./utils/config";
import userRoutes from "./routes/userRoutes";
import storeRoutes from "./routes/storeRoutes";
import productRoutes from "./routes/productRoutes";
import facingsRoutes from "./routes/facingsRoutes";
import priceRoutes from "./routes/priceRoutes";
import photoRoutes from "./routes/photoRoutes";
import path from "path";
const app = express();

app.use(cors());
app.use(express.static("dist"));
app.use(bodyParser.json());
app.use(logger);
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
  productRoutes
);
app.use(
  "/api/facings",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  facingsRoutes
);
app.use(
  "/api/price-checks",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  priceRoutes
);
app.use(
  "/api/photos",
  middleware.tokenExtractor,
  middleware.authenticateToken,
  middleware.userExtractor,
  photoRoutes
);
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
