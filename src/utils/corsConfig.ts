import cors, { CorsOptions } from "cors";

// Origins allowed to call the API. Set CORS_ORIGINS in the environment as a
// comma-separated list (e.g. "https://ppl.pages.dev,https://app.example.com").
// The localhost entries are the Vite dev server and a local build preview.
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS;

if (!allowedOrigins.length) {
  console.warn(
    `CORS_ORIGINS is not set; falling back to development origins: ${origins.join(
      ", "
    )}`
  );
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Same-origin and non-browser clients (curl, mobile, server-to-server)
    // send no Origin header; those are not subject to CORS at all.
    if (!origin || origins.includes(origin)) {
      callback(null, true);
      return;
    }
    const error = new Error("Origin not allowed by CORS") as Error & {
      status?: number;
    };
    error.status = 403;
    callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 86400,
};

export const corsConfig = cors(corsOptions);
export const allowedCorsOrigins = origins;
