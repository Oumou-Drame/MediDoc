import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

async function main() {
  try {
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      `UPDATE users SET password = $1, must_change_password = false, updated_at = NOW() 
       WHERE id = $2 AND role = 'lab_manager' RETURNING id, email, role`,
      [hashedPassword, 5]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Mot de passe réinitialisé avec succès !');
      console.log('📧 Email:', result.rows[0].email);
      console.log('🔑 Nouveau mot de passe:', newPassword);
    } else {
      console.log('❌ Compte non trouvé');
    }
    
    await pool.end();
  } catch(err) { 
    console.error('Erreur:', err); 
  }
}
main();