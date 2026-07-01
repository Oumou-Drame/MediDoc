import pool from './config/db.js';

async function migrate() {
  console.log('🚀 Ajout des colonnes reset_token et reset_expires à la table users...');

  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP;
    `);

    console.log('✅ Migration v4.1 terminée avec succès !');
    await pool.end();
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
