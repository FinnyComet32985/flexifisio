import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DB_PORT = parseInt(process.env.DB_PORT ?? "3306");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

export default pool;
