import bcrypt from 'bcryptjs';
import pool from './config/db.js';

async function resetAdminPassword() {
    try {
        const password = 'admin'; // ou passer123
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, 'admin@medidoc.sn']);
        console.log('Password for admin@medidoc.sn has been reset to: admin');
    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        pool.end();
    }
}

resetAdminPassword();
