import config from "./utils/config";
const app = require("./app");
import aiRoutes from "./routes/llmRoutes";

app.use("/api/ai", aiRoutes);

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
