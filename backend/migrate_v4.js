import pool from './config/db.js';

async function migrate() {
  console.log('🚀 Début de la migration MediDoc v4.0 (Multi-hôpitaux)...\n');

  try {
    // 1. Création de la table hospitals
    console.log('📌 Création de la table hospitals...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) UNIQUE NOT NULL,
        contact_phone VARCHAR(50),
        sms_sender_id VARCHAR(50),
        whatsapp_number VARCHAR(50),
        credits_balance DECIMAL(10, 2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ Table hospitals créée');

    // 2. Insérer un hôpital par défaut pour les données existantes
    console.log("📌 Création de l'hôpital par défaut...");
    const hResult = await pool.query(`
      INSERT INTO hospitals (name, contact_email) 
      VALUES ('Hôpital Principal (Défaut)', 'contact@hopital.com')
      ON CONFLICT (contact_email) DO NOTHING
      RETURNING id;
    `);
    
    let defaultHospitalId;
    if (hResult.rows.length > 0) {
      defaultHospitalId = hResult.rows[0].id;
    } else {
      const hExists = await pool.query(`SELECT id FROM hospitals WHERE contact_email = 'contact@hopital.com'`);
      defaultHospitalId = hExists.rows[0].id;
    }
    console.log(`   ✅ Hôpital par défaut ID : ${defaultHospitalId}`);

    // 3. Ajouter hospital_id aux tables users et medical_results
    console.log('📌 Ajout de hospital_id aux utilisateurs et résultats...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);`);
    await pool.query(`ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS hospital_id INTEGER REFERENCES hospitals(id);`);
    
    // Assigner l'hôpital par défaut aux enregistrements existants (sauf admins)
    await pool.query(`UPDATE users SET hospital_id = $1 WHERE hospital_id IS NULL AND role != 'admin'`, [defaultHospitalId]);
    await pool.query(`UPDATE medical_results SET hospital_id = $1 WHERE hospital_id IS NULL`, [defaultHospitalId]);

    // Rendre hospital_id obligatoire pour medical_results
    await pool.query(`ALTER TABLE medical_results ALTER COLUMN hospital_id SET NOT NULL;`);
    console.log('   ✅ Relations multi-hôpitaux établies');

    // 4. Supprimer les colonnes inutiles de users
    console.log('📌 Nettoyage de la table users (suppression username, date_naissance, matricule)...');
    
    // Supprimer la contrainte unique sur username d'abord si elle existe
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;`);
    } catch (e) {
      // Ignorer
    }

    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS username;`);
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS date_naissance;`);
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS matricule;`);
    console.log('   ✅ Colonnes obsolètes supprimées');

    // 5. Mettre à jour la contrainte des rôles
    console.log('📌 Mise à jour des rôles...');
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin', 'responsable_labo', 'technicien'));`);
    console.log('   ✅ Contrainte de rôle mise à jour');

    // 6. Création de la table transactions (historique crédits)
    console.log('📌 Création de la table transactions...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK(type IN ('recharge', 'usage')),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✅ Table transactions créée');

    console.log(`\n✅ Migration v4.0 terminée avec succès !`);
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
