// Script utilitaire pour exécuter un fichier de migration SQL sans avoir besoin
// de la commande psql (utile sous Windows si psql n'est pas dans le PATH).
// Utilise la même connexion (config/db.js) que le reste de l'application.
//
// Usage : node scripts/run-migration.js migrations/003_subscriptions.sql

import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';

const fileArg = process.argv[2];

if (!fileArg) {
    console.error('Usage: node scripts/run-migration.js <chemin-vers-le-fichier.sql>');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);

if (!fs.existsSync(filePath)) {
    console.error(`Fichier introuvable : ${filePath}`);
    process.exit(1);
}

const sql = fs.readFileSync(filePath, 'utf8');

try {
    console.log(`Exécution de ${fileArg}...`);
    await pool.query(sql);
    console.log('Migration exécutée avec succès.');
} catch (err) {
    console.error('Erreur lors de l\'exécution de la migration :', err.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
