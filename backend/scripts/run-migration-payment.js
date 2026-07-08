import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log('Exécution de la migration payment_transactions...');
    
    const migrationPath = path.join(__dirname, '../migrations/005_payment_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✓ Migration réussie : Table payment_transactions créée');
    
    // Vérification
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'payment_transactions'
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ Table payment_transactions vérifiée');
    } else {
      console.log('✗ Table payment_transactions non trouvée');
    }
    
    await pool.end();
  } catch(err) {
    console.error('Erreur lors de la migration:', err);
    process.exit(1);
  }
}

main();
