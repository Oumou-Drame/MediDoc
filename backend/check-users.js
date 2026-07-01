import pool from './config/db.js';

async function checkUsers() {
    try {
        const result = await pool.query('SELECT * FROM users');
        console.log('Users in database:', result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
    } finally {
        pool.end();
    }
}

checkUsers();
