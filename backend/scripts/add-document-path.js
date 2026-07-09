import pool from '../config/db.js';

async function main() {
  try {
    console.log('Adding document_path column to hospital_requests...');
    await pool.query('ALTER TABLE hospital_requests ADD COLUMN IF NOT EXISTS document_path VARCHAR(255)');
    console.log('Column document_path added successfully.');
    await pool.end();
  } catch (err) {
    console.error('Error altering table:', err);
  }
}

main();
