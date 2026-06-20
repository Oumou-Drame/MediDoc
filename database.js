const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'medidoc',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Erreur de connexion PostgreSQL:', err.message);
});

// Helper: run a query
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

// Helper: get a single row
async function queryOne(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

// Helper: get all rows
async function queryAll(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function initDatabase() {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion à PostgreSQL établie');

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'technician')),
        phone VARCHAR(50),
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_results (
        id SERIAL PRIMARY KEY,
        technician_id INTEGER NOT NULL REFERENCES users(id),
        patient_name VARCHAR(255) NOT NULL,
        patient_phone VARCHAR(50) NOT NULL,
        patient_email VARCHAR(255),
        original_filename TEXT NOT NULL,
        protected_filename TEXT NOT NULL,
        access_code VARCHAR(10) NOT NULL,
        access_token VARCHAR(64) NOT NULL,
        channel VARCHAR(50) NOT NULL CHECK(channel IN ('email', 'sms', 'whatsapp', 'email_sms', 'email_whatsapp', 'sms_whatsapp', 'all')),
        status VARCHAR(50) DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'accessed', 'expired', 'locked')),
        whatsapp_sent INTEGER DEFAULT 0,
        sms_sent INTEGER DEFAULT 0,
        email_sent INTEGER DEFAULT 0,
        code_accessed INTEGER DEFAULT 0,
        access_count INTEGER DEFAULT 0,
        attempt_count INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        accessed_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tables créées avec succès');

    // Migration: ensure all columns exist in users table (for existing databases)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
    // Rename password_hash to password if needed
    const hasPassword = await queryOne(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') as exists"
    );
    if (!hasPassword.exists) {
      const hasPasswordHash = await queryOne(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') as exists"
      );
      if (hasPasswordHash.exists) {
        await pool.query(`ALTER TABLE users RENAME COLUMN password_hash TO password`);
      } else {
        await pool.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT ''`);
      }
    }
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    // Migration: add new columns to medical_results table
    await pool.query(`ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS is_locked INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE medical_results ADD COLUMN IF NOT EXISTS access_token VARCHAR(64)`);

    // Add UNIQUE constraint on email if not present
    try {
      await pool.query(`ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)`);
    } catch (e) {
      // Ignore if constraint already exists or duplicate values
      if (!e.message.includes('existe déjà') && !e.message.includes('already exists') && e.code !== '42710' && e.code !== '23505') throw e;
    }

    // Create default admin
    const adminExists = await queryOne('SELECT id FROM users WHERE role = $1', ['admin']);
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, phone, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['admin', 'admin@medidoc.sn', hashedPassword, 'Administrateur MediDoc', 'admin', null, 1]
      );
      console.log('✅ Compte admin créé: admin / admin123');
    }

    // Create default technician
    const techExists = await queryOne('SELECT id FROM users WHERE role = $1', ['technician']);
    if (!techExists) {
      const hashedPassword = await bcrypt.hash('tech123', 10);
      await pool.query(
        `INSERT INTO users (username, email, password, full_name, role, phone, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        ['tech01', 'tech@medidoc.sn', hashedPassword, 'Dr. Amine Fall', 'technician', '+221771234567', 1]
      );
      console.log('✅ Compte technicien créé: tech01 / tech123');
    }

    // Create default settings
    const settingsCount = await queryOne('SELECT COUNT(*) as count FROM settings', []);
    if (parseInt(settingsCount.count) === 0) {
      const defaultSettings = [
        ['whatsapp_enabled', 'true'],
        ['sms_enabled', 'true'],
        ['email_enabled', 'true'],
        ['code_expiration_hours', '48'],
        ['max_file_size_mb', '50']
      ];
      for (const [key, value] of defaultSettings) {
        await pool.query(
          `INSERT INTO settings (setting_key, setting_value, updated_at) VALUES ($1, $2, NOW())`,
          [key, value]
        );
      }
      console.log('✅ Paramètres par défaut créés');
    }

    console.log('✅ Base de données PostgreSQL initialisée avec succès');
  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', err.message);
    throw err;
  }
}

function getPool() {
  return pool;
}

// Run if called directly
if (require.main === module) {
  initDatabase().then(() => {
    console.log('Initialisation terminée');
    process.exit(0);
  }).catch(err => {
    console.error('Échec:', err);
    process.exit(1);
  });
}

module.exports = { initDatabase, getPool, query, queryOne, queryAll };