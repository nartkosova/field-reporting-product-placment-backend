import config from "./utils/config";
const app = require("./app");

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
