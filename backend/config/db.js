import { Pool } from 'pg';
import dotenv from 'dotenv';
// Connexion à la base de données 
dotenv.config();
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD


});

pool.on("connect", () => {
    console.log("Connected to the database")
});

pool.on("error", (err) => {
    console.error("Database error", err)
}
);
export async function query(text, params) {
    return pool.query(text, params);
}

export async function queryOne(text, params) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
}

export async function queryAll(text, params) {
    const result = await pool.query(text, params);
    return result.rows;
}
export default pool;