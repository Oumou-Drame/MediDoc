import pool from './config/db.js';
import bcrypt from 'bcryptjs';

async function seed() {
    console.log('🌱 Initialisation des données de test...');

    try {
        const hashedPassword = await bcrypt.hash('password', 10);

        // 1. Admin global
        const adminEmail = 'admin@medidoc.com';
        const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (adminExists.rows.length === 0) {
            await pool.query(
                `INSERT INTO users (email, password, full_name, role, is_active, hospital_id)
                 VALUES ($1, $2, $3, $4, 1, NULL)`,
                [adminEmail, hashedPassword, 'Super Admin', 'admin']
            );
            console.log(`✅ Admin global créé : ${adminEmail} (password: password)`);
        } else {
            console.log(`ℹ️ Admin global existe déjà : ${adminEmail}`);
        }

        // 2. Hôpitaux
        const hospitals = [
            { name: 'Hôpital Test A', email: 'contact@hopitalA.com' },
            { name: 'Hôpital Test B', email: 'contact@hopitalB.com' }
        ];

        for (const h of hospitals) {
            const hQuery = await pool.query(
                `INSERT INTO hospitals (name, contact_email, credits_balance) 
                 VALUES ($1, $2, 5000.00) 
                 ON CONFLICT (contact_email) DO UPDATE SET name = EXCLUDED.name 
                 RETURNING id`,
                [h.name, h.email]
            );
            const hospitalId = hQuery.rows[0].id;
            console.log(`✅ Hôpital créé/mis à jour : ${h.name} (ID: ${hospitalId})`);

            // Créer les employés pour cet hôpital
            const employees = [
                { email: `responsable@${h.name.replace(/\s+/g, '').toLowerCase()}.com`, name: `Resp ${h.name}`, role: 'responsable_labo' },
                { email: `tech1@${h.name.replace(/\s+/g, '').toLowerCase()}.com`, name: `Tech 1 ${h.name}`, role: 'technicien' }
            ];

            for (const emp of employees) {
                const empExists = await pool.query('SELECT id FROM users WHERE email = $1', [emp.email]);
                if (empExists.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO users (email, password, full_name, role, is_active, hospital_id)
                         VALUES ($1, $2, $3, $4, 1, $5)`,
                        [emp.email, hashedPassword, emp.name, emp.role, hospitalId]
                    );
                    console.log(`   👤 ${emp.role} créé : ${emp.email}`);
                }
            }
        }

        console.log('\n🎉 Seed terminé avec succès !');
        await pool.end();
    } catch (error) {
        console.error('❌ Erreur lors du seed:', error);
        await pool.end();
        process.exit(1);
    }
}

seed();
