import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log('Exécution de la migration hospital_documents...');
    
    const migrationPath = path.join(__dirname, '../migrations/006_hospital_documents.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✓ Migration réussie : Table hospital_documents créée');
    
    // Vérification
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'hospital_documents'
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ Table hospital_documents vérifiée');
    } else {
      console.log('✗ Table hospital_documents non trouvée');
    }
    
    await pool.end();
  } catch(err) {
    console.error('Erreur lors de la migration:', err);
    process.exit(1);
  }
}

main();
