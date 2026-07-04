import { queryOne, query, queryAll } from '../config/db.js';

// Solde virtuel par hôpital pour les envois SMS/WhatsApp (voir cadrage, section 7.1).
// Indépendant du solde réel global détenu par la plateforme chez le fournisseur.

export async function getBalance(hospitalId) {
    const row = await queryOne('SELECT balance FROM hospital_credits WHERE hospital_id = $1', [hospitalId]);
    return row ? parseFloat(row.balance) : 0;
}

export async function hasCredit(hospitalId) {
    return (await getBalance(hospitalId)) > 0;
}

// Déduit le coût réel d'un envoi réussi du solde virtuel de l'hôpital concerné.
export async function deduct(hospitalId, amount, { resultId = null, note = null } = {}) {
    if (amount <= 0) return getBalance(hospitalId);

    const existing = await queryOne('SELECT balance FROM hospital_credits WHERE hospital_id = $1 FOR UPDATE', [hospitalId]);
    const currentBalance = existing ? parseFloat(existing.balance) : 0;
    const newBalance = Math.max(0, currentBalance - amount);

    if (existing) {
        await query('UPDATE hospital_credits SET balance = $1, updated_at = NOW() WHERE hospital_id = $2', [newBalance, hospitalId]);
    } else {
        await query('INSERT INTO hospital_credits (hospital_id, balance) VALUES ($1, $2)', [hospitalId, newBalance]);
    }

    await query(
        `INSERT INTO hospital_credit_transactions (hospital_id, type, amount, balance_after, related_result_id, note, created_at)
         VALUES ($1, 'deduction', $2, $3, $4, $5, NOW())`,
        [hospitalId, -Math.abs(amount), newBalance, resultId, note]
    );

    return newBalance;
}

// Allocation manuelle par l'admin plateforme, après réception du paiement hors plateforme (voir section 7.1).
export async function recharge(hospitalId, amount, adminUserId, note = null) {
    if (amount <= 0) {
        throw new Error('Le montant de la recharge doit être positif');
    }

    const existing = await queryOne('SELECT balance FROM hospital_credits WHERE hospital_id = $1 FOR UPDATE', [hospitalId]);
    const currentBalance = existing ? parseFloat(existing.balance) : 0;
    const newBalance = currentBalance + amount;

    if (existing) {
        await query('UPDATE hospital_credits SET balance = $1, updated_at = NOW() WHERE hospital_id = $2', [newBalance, hospitalId]);
    } else {
        await query('INSERT INTO hospital_credits (hospital_id, balance) VALUES ($1, $2)', [hospitalId, newBalance]);
    }

    await query(
        `INSERT INTO hospital_credit_transactions (hospital_id, type, amount, balance_after, note, created_by, created_at)
         VALUES ($1, 'recharge', $2, $3, $4, $5, NOW())`,
        [hospitalId, amount, newBalance, note, adminUserId]
    );

    return newBalance;
}

// Remboursement du solde virtuel (ex: annulation d'un envoi déjà facturé). Voir section 7.1.
export async function refund(hospitalId, amount, { resultId = null, note = null } = {}) {
    if (amount <= 0) return getBalance(hospitalId);

    const existing = await queryOne('SELECT balance FROM hospital_credits WHERE hospital_id = $1 FOR UPDATE', [hospitalId]);
    const currentBalance = existing ? parseFloat(existing.balance) : 0;
    const newBalance = currentBalance + amount;

    if (existing) {
        await query('UPDATE hospital_credits SET balance = $1, updated_at = NOW() WHERE hospital_id = $2', [newBalance, hospitalId]);
    } else {
        await query('INSERT INTO hospital_credits (hospital_id, balance) VALUES ($1, $2)', [hospitalId, newBalance]);
    }

    await query(
        `INSERT INTO hospital_credit_transactions (hospital_id, type, amount, balance_after, related_result_id, note, created_at)
         VALUES ($1, 'adjustment', $2, $3, $4, $5, NOW())`,
        [hospitalId, amount, newBalance, resultId, note]
    );

    return newBalance;
}

export async function getTransactions(hospitalId, limit = 50) {
    return queryAll(
        'SELECT * FROM hospital_credit_transactions WHERE hospital_id = $1 ORDER BY created_at DESC LIMIT $2',
        [hospitalId, limit]
    );
}

export async function getAllBalances() {
    return queryAll(
        `SELECT h.id as hospital_id, h.name as hospital_name, COALESCE(hc.balance, 0) as balance
         FROM hospitals h
         LEFT JOIN hospital_credits hc ON hc.hospital_id = h.id
         ORDER BY h.name`,
        []
    );
}
