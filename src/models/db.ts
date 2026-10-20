import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Read and write TIMESTAMPs as UTC. Without this, a UTC database session and
  // a server in local time shift every check-in time by the UTC offset.
  timezone: "Z",
});

db.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export default db;
