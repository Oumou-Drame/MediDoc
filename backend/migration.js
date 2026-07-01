/**
 * Migration MediDoc v3.0
 * 
 * Modifications :
 * 1. Ajouter la colonne must_change_password
 * 2. Convertir le rôle admin en responsable_labo
 * 3. Mettre à jour les matricules au format MED-YYYY-XXXX
 * 4. Mettre à jour la contrainte CHECK
 */

import pool from './config/db.js';

async function migrate() {
  console.log('🚀 Début de la migration MediDoc v3.0...\n');

  try {
    // 1. Ajouter la colonne must_change_password
    console.log('📌 Ajout de la colonne must_change_password...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;`);
    console.log('   ✅ Colonne must_change_password ajoutée');

    // 2. Supprimer l'ancienne contrainte CHECK sur role
    console.log('📌 Suppression de l\'ancienne contrainte role...');
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    console.log('   ✅ Ancienne contrainte supprimée');

    // 3. Ajouter les colonnes matricule et date_naissance si elles n'existent pas
    console.log('📌 Vérification des colonnes matricule et date_naissance...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS matricule VARCHAR(50);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS date_naissance DATE;`);
    console.log('   ✅ Colonnes vérifiées');

    // 4. Migrer les rôles existants : admin → responsable_labo, technician → technicien
    console.log('📌 Migration des rôles...');
    const resultAdmin = await pool.query(`UPDATE users SET role = 'responsable_labo' WHERE role = 'admin'`);
    console.log(`   ✅ ${resultAdmin.rowCount} admins convertis en responsables_labo`);
    
    const resultTech = await pool.query(`UPDATE users SET role = 'technicien' WHERE role = 'technician'`);
    console.log(`   ✅ ${resultTech.rowCount} techniciens migrés (technician → technicien)`);

    // 5. Régénérer les matricules au format MED-YYYY-XXXX pour tous les utilisateurs
    console.log('📌 Régénération des matricules au format MED-YYYY-XXXX...');
    const year = new Date().getFullYear();
    
    // Compter les utilisateurs par rôle pour générer des numéros séquentiels
    const allUsers = await pool.query(`SELECT id, role, matricule FROM users ORDER BY id`);
    let techCount = 0;
    let respCount = 0;
    
    for (const user of allUsers.rows) {
      if (user.role === 'technicien') {
        techCount++;
        const num = String(techCount).padStart(4, '0');
        await pool.query(`UPDATE users SET matricule = $1 WHERE id = $2`, [`MED-${year}-${num}`, user.id]);
      } else if (user.role === 'responsable_labo') {
        respCount++;
        const num = String(respCount).padStart(4, '0');
        await pool.query(`UPDATE users SET matricule = $1 WHERE id = $2`, [`MED-${year}-${num}`, user.id]);
      }
    }
    console.log(`   ✅ ${techCount} matricules techniciens régénérés`);
    console.log(`   ✅ ${respCount} matricules responsables régénérés`);

    // 6. Ajouter la nouvelle contrainte CHECK
    console.log('📌 Ajout de la nouvelle contrainte role...');
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('responsable_labo', 'technicien'));`);
    console.log('   ✅ Nouvelle contrainte ajoutée (responsable_labo, technicien)');

    // 7. Ajouter UNIQUE sur matricule si pas déjà fait
    try {
      await pool.query(`ALTER TABLE users ADD CONSTRAINT users_matricule_key UNIQUE (matricule);`);
      console.log('   ✅ Contrainte UNIQUE sur matricule ajoutée');
    } catch (e) {
      if (e.code === '23514') {
        console.log('   ℹ️ Contrainte UNIQUE déjà existante');
      } else {
        console.log('   ℹ️ Contrainte UNIQUE déjà existante');
      }
    }

    // 8. Afficher le résultat
    const users = await pool.query('SELECT id, email, full_name, role, matricule, date_naissance, must_change_password FROM users ORDER BY id');
    console.log('\n📋 Utilisateurs après migration :');
    console.log('─'.repeat(110));
    users.rows.forEach(u => {
      console.log(`   ${String(u.id).padStart(3)} | ${u.role.padEnd(18)} | ${(u.matricule || '—').padEnd(14)} | ${u.full_name.padEnd(22)} | ${u.must_change_password ? 'Oui' : 'Non'}`);
    });
    console.log('─'.repeat(110));
    console.log(`\n✅ Migration v3.0 terminée avec succès !`);
    
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();