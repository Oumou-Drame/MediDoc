import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

async function main() {
  try {
    // 1. Activer la double capacité sur le lab_manager id=5 (responsable@hôpitaltesta.com)
    const result = await pool.query(
      `UPDATE users SET is_technician = true, active_view = 'lab_manager', updated_at = NOW() 
       WHERE id = $1 AND role = 'lab_manager' RETURNING id, email, role, is_technician, active_view`,
      [5]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Double capacité activée pour le lab_manager :');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ Lab_manager id=5 non trouvé');
    }

    // 2. Vérifier le résultat
    const check = await pool.query(
      "SELECT id, email, role, is_technician, active_view FROM users WHERE id = 5"
    );
    console.log('\n📋 Vérification :');
    console.log(JSON.stringify(check.rows[0], null, 2));
    
    await pool.end();
  } catch(err) { 
    console.error('Erreur:', err); 
  }
}
main();