const { Pool } = require('pg');
const p = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'medidoc_db',
  user: 'postgres',
  password: 'icandoit'
});

async function check() {
  try {
    const result = await p.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
    );
    console.log('Users table columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.end();
  }
}

check();