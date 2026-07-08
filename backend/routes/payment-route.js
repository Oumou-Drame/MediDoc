import express from 'express';
import crypto from 'crypto';
import { protect, requireHospitalUser } from '../middleware/auth-middleware.js';
import { queryOne, query } from '../config/db.js';

const router = express.Router();

// Initialize payment transaction
router.post('/initialize', protect, requireHospitalUser, async (req, res) => {
    const { plan_id, email, amount } = req.body;
    
    if (!plan_id || !email || !amount) {
        return res.status(400).json({ error: 'Plan, email et montant requis' });
    }

    try {
        const plan = await queryOne(
            'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true',
            [plan_id]
        );
        
        if (!plan) {
            return res.status(404).json({ error: 'Pack non trouvé' });
        }

        // Convert amount to kobo (Paystack uses smallest currency unit)
        const amountInKobo = Math.round(amount * 100);
        
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                amount: amountInKobo,
                currency: 'XOF',
                metadata: {
                    plan_id: plan_id,
                    hospital_id: req.user.hospital_id,
                    user_id: req.user.id
                },
                callback_url: `${process.env.FRONTEND_URL}/subscription/payment/callback`
            })
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok) {
            console.error('Paystack error:', paystackData);
            return res.status(500).json({ error: 'Erreur lors de l\'initialisation du paiement' });
        }

        // Store pending transaction
        await query(
            `INSERT INTO payment_transactions (hospital_id, plan_id, user_id, reference, amount, currency, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                req.user.hospital_id,
                plan_id,
                req.user.id,
                paystackData.data.reference,
                amount,
                'XOF',
                'pending',
                JSON.stringify(paystackData.data.metadata)
            ]
        );

        res.json({ 
            success: true, 
            data: {
                authorization_url: paystackData.data.authorization_url,
                reference: paystackData.data.reference
            }
        });
    } catch (err) {
        console.error('Initialize payment error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Verify payment transaction
router.get('/verify/:reference', protect, requireHospitalUser, async (req, res) => {
    const { reference } = req.params;

    try {
        const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            }
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok) {
            console.error('Paystack verify error:', paystackData);
            return res.status(500).json({ error: 'Erreur lors de la vérification du paiement' });
        }

        const transaction = paystackData.data;
        
        // Update transaction in database
        await query(
            `UPDATE payment_transactions 
             SET status = $1, gateway_response = $2, paid_at = NOW()
             WHERE reference = $3`,
            [transaction.status, JSON.stringify(transaction), reference]
        );

        // If payment successful, activate subscription
        if (transaction.status === 'success') {
            const metadata = transaction.metadata;
            const plan = await queryOne(
                'SELECT duration_days FROM subscription_plans WHERE id = $1',
                [metadata.plan_id]
            );

            const now = new Date();
            const end_date = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

            // Create or update subscription without relying on ON CONFLICT (hospital_id)
            const existing = await queryOne(
                `SELECT id FROM hospital_subscriptions WHERE hospital_id = $1 ORDER BY chosen_at DESC LIMIT 1`,
                [metadata.hospital_id]
            );

            if (existing) {
                await query(
                    `UPDATE hospital_subscriptions
                     SET plan_id = $1,
                         status = $2,
                         payment_status = $3,
                         start_date = $4,
                         end_date = $5,
                         transaction_id = $6,
                         chosen_at = NOW()
                     WHERE id = $7`,
                    [
                        metadata.plan_id,
                        'active',
                        'paid',
                        now,
                        end_date,
                        reference,
                        existing.id
                    ]
                );
            } else {
                await query(
                    `INSERT INTO hospital_subscriptions (hospital_id, plan_id, status, payment_status, start_date, end_date, transaction_id, chosen_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    [
                        metadata.hospital_id,
                        metadata.plan_id,
                        'active',
                        'paid',
                        now,
                        end_date,
                        reference
                    ]
                );
            }

            await query('UPDATE users SET has_chosen_plan = true WHERE id = $1', [metadata.user_id]);
        }

        res.json({ 
            success: true, 
            data: {
                status: transaction.status,
                message: transaction.status === 'success' ? 'Paiement réussi' : 'Paiement en cours ou échoué'
            }
        });
    } catch (err) {
        console.error('Verify payment error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Webhook for Paystack events
router.post('/webhook', async (req, res) => {
    const event = req.body;
    
    // Verify webhook signature
    const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
    
    if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).json({ error: 'Signature invalide' });
    }

    try {
        if (event.event === 'charge.success') {
            const transaction = event.data;
            const metadata = transaction.metadata;

            // Update transaction
            await query(
                `UPDATE payment_transactions 
                 SET status = $1, gateway_response = $2, paid_at = NOW()
                 WHERE reference = $3`,
                ['success', JSON.stringify(transaction), transaction.reference]
            );

            // Activate subscription
            const plan = await queryOne(
                'SELECT duration_days FROM subscription_plans WHERE id = $1',
                [metadata.plan_id]
            );

            const now = new Date();
            const end_date = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

            // Create or update subscription without relying on ON CONFLICT (hospital_id)
            const existing = await queryOne(
                `SELECT id FROM hospital_subscriptions WHERE hospital_id = $1 ORDER BY chosen_at DESC LIMIT 1`,
                [metadata.hospital_id]
            );

            if (existing) {
                await query(
                    `UPDATE hospital_subscriptions
                     SET plan_id = $1,
                         status = $2,
                         payment_status = $3,
                         start_date = $4,
                         end_date = $5,
                         transaction_id = $6,
                         chosen_at = NOW()
                     WHERE id = $7`,
                    [
                        metadata.plan_id,
                        'active',
                        'paid',
                        now,
                        end_date,
                        transaction.reference,
                        existing.id
                    ]
                );
            } else {
                await query(
                    `INSERT INTO hospital_subscriptions (hospital_id, plan_id, status, payment_status, start_date, end_date, transaction_id, chosen_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                    [
                        metadata.hospital_id,
                        metadata.plan_id,
                        'active',
                        'paid',
                        now,
                        end_date,
                        transaction.reference
                    ]
                );
            }

            await query('UPDATE users SET has_chosen_plan = true WHERE id = $1', [metadata.user_id]);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
