import pool from '../config/db.js';

async function main() {
  try {
    const hospitals = await pool.query('SELECT id, name FROM hospitals');
    console.log('Hôpitaux existants:', JSON.stringify(hospitals.rows, null, 2));
    
    const users = await pool.query("SELECT id, email, role, is_technician FROM users");
    console.log('Utilisateurs existants:', JSON.stringify(users.rows, null, 2));
    
    await pool.end();
  } catch(err) { console.error(err); }
}
main();