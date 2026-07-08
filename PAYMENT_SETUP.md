# Configuration du système de paiement en ligne - MediDoc

## Vue d'ensemble
Le système de paiement en ligne a été intégré pour permettre aux hôpitaux de payer leurs abonnements via Paystack (supporte la devise XOF).

## Étapes de configuration

### 1. Configuration des variables d'environnement (Backend)

Ajoutez les variables suivantes à votre fichier `backend/.env` :

```env
# Clé secrète Paystack (obtenez-la sur https://dashboard.paystack.co/)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# URL de votre frontend pour le callback après paiement
FRONTEND_URL=http://localhost:4200
```

**Pour obtenir la clé Paystack :**
1. Créez un compte sur https://paystack.co
2. Allez dans le Dashboard > Settings > API Keys
3. Copiez la "Secret Key" (en mode Test pour développement, Live pour production)

### 2. Exécuter la migration de base de données

Exécutez le fichier de migration pour créer la table des transactions de paiement :

```bash
# Dans le dossier backend
psql -U votre_user -d votre_database -f migrations/005_payment_transactions.sql
```

Ou via un outil de gestion de base de données (pgAdmin, DBeaver, etc.)

### 3. Configuration du webhook Paystack (Production uniquement)

Pour la production, configurez le webhook Paystack pour recevoir les notifications de paiement :

1. Allez dans votre Dashboard Paystack > Settings > Webhooks
2. Ajoutez l'URL : `https://votre-domaine.com/api/payment/webhook`
3. Paystack enverra automatiquement les événements de paiement réussi

## Fonctionnalités implémentées

### Backend (`backend/routes/payment-route.js`)
- **POST /api/payment/initialize** : Initialise une transaction de paiement
- **GET /api/payment/verify/:reference** : Vérifie le statut d'un paiement
- **POST /api/payment/webhook** : Reçoit les notifications de Paystack

### Frontend
- **Service de paiement** (`subscription-service.ts`) : Méthodes pour initialiser et vérifier les paiements
- **Composant de callback** (`payment-callback`) : Page de retour après paiement avec vérification automatique
- **Intégration choix d'abonnement** : Redirection automatique vers Paystack pour les plans payants

## Flux de paiement

1. L'utilisateur choisit un pack payant
2. Le système initialise la transaction via Paystack
3. L'utilisateur est redirigé vers la page de paiement sécurisée Paystack
4. Après paiement, Paystack redirige vers `/subscription/payment/callback?reference=xxx`
5. Le frontend vérifie le statut du paiement
6. Si succès, l'abonnement est activé automatiquement

## Test du système

### En mode test (Paystack Test Mode)
1. Utilisez la clé secrète de test
2. Paystack fournit des cartes de test : https://paystack.com/docs/payments/test-payments
3. Carte de test courante : `4084 0840 4084 0840` (n'importe quelle date future, CVC n'importe quoi)

### En mode production
1. Remplacez la clé de test par la clé live
2. Configurez le webhook pour recevoir les notifications réelles
3. Testez avec une vraie carte

## Dépannage

### Erreur "Erreur lors de l'initialisation du paiement"
- Vérifiez que `PAYSTACK_SECRET_KEY` est correctement configurée
- Vérifiez que l'email de l'utilisateur est disponible

### Erreur "Référence de transaction manquante"
- Vérifiez que l'URL de callback est correctement configurée dans Paystack
- Vérifiez que `FRONTEND_URL` correspond à votre domaine

### Paiement réussi mais abonnement non activé
- Vérifiez les logs backend pour les erreurs webhook
- Vérifiez que la table `payment_transactions` est créée
- Vérifiez que la connexion à la base de données fonctionne

## Sécurité

- Les clés Paystack ne doivent jamais être exposées dans le frontend
- Utilisez toujours HTTPS en production
- Le webhook vérifie la signature Paystack pour éviter les requêtes falsifiées
- Les transactions sont stockées avec un statut pour traçabilité

## Support

Pour toute question sur l'intégration Paystack :
- Documentation : https://paystack.com/docs/api
- Support : https://support.paystack.co
