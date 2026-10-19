import { loadServerConfig } from "./server-config";
import mysql from "mysql2/promise";
loadServerConfig();
let pool;
export function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function database() {
  if (!pool)
    pool = mysql.createPool({
      host: required("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: required("MYSQL_USER"),
      password: required("MYSQL_PASSWORD"),
      database: required("MYSQL_DATABASE"),
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
      supportBigNumbers: true,
      bigNumberStrings: true,
      timezone: "Z",
    });
  return pool;
}
