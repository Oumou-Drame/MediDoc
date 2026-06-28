const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'medidoc_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'icandoit',
});

async function clearData() {
  try {
    await pool.query('DELETE FROM activity_logs');
    console.log('✅ activity_logs cleared');
    await pool.query('DELETE FROM medical_results');
    console.log('✅ medical_results cleared');
    console.log('✅ All test data deleted successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

clearData();