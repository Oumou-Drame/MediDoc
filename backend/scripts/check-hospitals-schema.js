import pool from '../config/db.js';

async function main() {
  try {
    const result = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hospitals' ORDER BY ordinal_position"
    );
    console.log('Colonnes de la table hospitals:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Vérifier si la colonne status existe dans une autre table
    const requestsResult = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hospital_requests' ORDER BY ordinal_position"
    );
    console.log('\nColonnes de la table hospital_requests:');
    console.log(JSON.stringify(requestsResult.rows, null, 2));
    
    await pool.end();
  } catch(err) { 
    console.error('Erreur:', err); 
  }
}
main();