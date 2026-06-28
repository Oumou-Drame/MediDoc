const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'medidoc',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

console.log('Vérification de la connexion PostgreSQL...');

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as database');
    console.log('✅ PostgreSQL est actif!');
    console.log('   Heure:', result.rows[0].time);
    console.log('   Base:', result.rows[0].database);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.log('❌ Erreur de connexion PostgreSQL:', err.message);
    await pool.end();
    process.exit(1);
  }
}

testConnection();