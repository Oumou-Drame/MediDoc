// Crée le tout premier (ou un nouveau) admin plateforme.
// À exécuter une fois après la migration 001_multi_hospital.sql, car celle-ci convertit
// tous les anciens comptes 'admin' en 'lab_manager' (ils géraient en réalité un hôpital,
// pas la plateforme) — voir cadrage section 9 de la migration.
//
// Usage :
//   node scripts/create-platform-admin.js "admin@medidoc.sn" "Mot de passe sûr" "Nom complet"

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { queryOne, query } from '../config/db.js';

async function main() {
    const [, , email, password, fullName] = process.argv;

    if (!email || !password || !fullName) {
        console.error('Usage: node scripts/create-platform-admin.js <email> <mot_de_passe> "<nom complet>"');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Le mot de passe doit contenir au moins 8 caractères');
        process.exit(1);
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing) {
        console.error(`Un compte existe déjà avec l'email ${email}`);
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await queryOne(
        `INSERT INTO users (email, password, full_name, role, hospital_id, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', NULL, 1, NOW(), NOW()) RETURNING id, email`,
        [email.toLowerCase(), hashedPassword, fullName]
    );

    console.log(`✅ Admin plateforme créé : ${user.email} (id ${user.id})`);
    await pool.end();
}

main().catch((err) => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
});
