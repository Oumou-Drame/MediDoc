import pool from './config/db.js';

async function drop() {
    try {
        const triggers = await pool.query("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'users'");
        console.log("Triggers on users:", triggers.rows);
        
        for (const t of triggers.rows) {
            await pool.query(`DROP TRIGGER IF EXISTS ${t.trigger_name} ON users CASCADE`);
            console.log(`Dropped trigger ${t.trigger_name}`);
        }
        
        await pool.end();
    } catch(e) {
        console.error(e);
        await pool.end();
    }
}
drop();
