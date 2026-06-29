import pg from 'pg';
const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'medidoc_db',
  user: 'postgres',
  password: 'icandoit'
});

pool.query('SELECT * FROM users WHERE username = $1', ['tech01'])
  .then(r => {
    console.log('User found:', JSON.stringify(r.rows, null, 2));
    pool.end();
  })
  .catch(e => {
    console.error('Query error:', e.message);
    pool.end();
  });