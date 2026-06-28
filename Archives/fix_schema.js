const { Pool } = require('pg');
const p = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'medidoc_db',
  user: 'postgres',
  password: 'icandoit'
});

async function fixSchema() {
  try {
    // Add email column if missing
    await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    console.log('✅ email column ensured');

    // Add password column if missing (rename from password_hash if needed)
    const hasPassword = await p.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password')"
    );
    const hasPasswordHash = await p.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash')"
    );

    if (!hasPassword.rows[0].exists && hasPasswordHash.rows[0].exists) {
      await p.query('ALTER TABLE users RENAME COLUMN password_hash TO password');
      console.log('✅ Renamed password_hash to password');
    } else if (!hasPassword.rows[0].exists) {
      await p.query('ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT \'\'');
      console.log('✅ Added password column');
    } else {
      console.log('✅ password column already exists');
    }

    // Add other missing columns
    await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT \'\'');
    console.log('✅ full_name column ensured');

    await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)');
    console.log('✅ phone column ensured');

    await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1');
    console.log('✅ is_active column ensured');

    await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    console.log('✅ updated_at column ensured');

    // Add UNIQUE constraint on email if not present
    try {
      await p.query('ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)');
      console.log('✅ UNIQUE constraint on email added');
    } catch (e) {
      if (e.code === '42710' || e.code === '23505') {
        console.log('ℹ️ UNIQUE constraint on email already exists');
      } else {
        throw e;
      }
    }

    // Show final schema
    const result = await p.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
    );
    console.log('\nFinal users table columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await p.end();
  }
}

fixSchema();