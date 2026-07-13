# Analyse complète du projet MediDoc

## Vue d'ensemble

**MediDoc** est une plateforme SaaS multi-hôpitaux pour la gestion sécurisée et l'envoi de résultats médicaux aux patients. L'application permet aux laboratoires d'hôpitaux d'envoyer des résultats de manière sécurisée via plusieurs canaux (WhatsApp, SMS, Email) avec un système de codes d'accès temporaires.

## Architecture technique

### Stack technologique

**Backend** (`backend/`) :
- Node.js avec Express.js
- PostgreSQL comme base de données
- Authentification JWT avec bcrypt
- Multer pour l'upload de fichiers
- Intégrations : WhatsApp (Baileys), Email (Nodemailer), SMS (Twilio), Paiement (Paystack)
- PDF-lib pour la protection des PDF

**Frontend** (`frontend/medidoc-frontend/`) :
- Angular 20.2
- TypeScript
- Architecture modulaire avec features
- Guards pour l'authentification et les rôles
- Services pour la communication API

### Structure des dossiers

```
medidoc3/
├── backend/
│   ├── config/db.js           # Configuration PostgreSQL
│   ├── middleware/            # Auth middleware
│   ├── migrations/            # Schéma BDD évolutif
│   ├── routes/                # API endpoints
│   ├── utils/                 # WhatsApp, SMS, Email, PDF, Crédits
│   └── server.js              # Point d'entrée
├── frontend/medidoc-frontend/
│   └── src/app/
│       ├── core/              # Services, guards, modèles
│       └── features/          # Modules fonctionnels
└── Archives/                  # Documentation technique
```

## Base de données

### Tables principales

**Gestion des hôpitaux** :
- `hospitals` - Établissements inscrits
- `hospital_requests` - Demandes d'inscription
- `hospital_documents` - Documents de vérification
- `hospital_send_config` - Configuration SMTP/SMS par hôpital
- `hospital_credits` - Solde de crédits SMS/WhatsApp
- `hospital_credit_transactions` - Historique des transactions

**Utilisateurs** :
- `users` - Comptes avec rôles (admin, lab_manager, technician)
- `password_reset_tokens` - Réinitialisation mot de passe

**Résultats médicaux** :
- `medical_results` - Résultats envoyés avec codes d'accès

**Abonnements** :
- `subscription_plans` - Packs d'abonnement (Essentiel, Standard, Premium)
- `hospital_subscriptions` - Abonnements actifs
- `payment_transactions` - Transactions Paystack

**Autres** :
- `activity_logs` - Journal d'activité
- `settings` - Paramètres plateforme

## Rôles et permissions

### 1. **Admin plateforme** (`admin`)
- Gestion des demandes d'inscription hôpitaux
- Validation/rejet des hôpitaux
- Gestion des packs d'abonnement
- Surveillance des abonnements
- Configuration WhatsApp (QR code)
- Aucun accès aux données patients

### 2. **Responsable de labo** (`lab_manager`)
- Dashboard statistiques de son hôpital
- Gestion des comptes techniciens (CRUD)
- Historique des envois
- Gestion des crédits SMS/WhatsApp
- Journal d'activité de l'équipe
- Peut cumuler le rôle technicien (`is_technician`)

### 3. **Technicien** (`technician`)
- Upload de PDF de résultats
- Envoi via WhatsApp+Email ou Email+SMS
- Historique personnel des envois
- Annulation d'envois

## Flux fonctionnels principaux

### 1. Inscription d'un hôpital

1. Formulaire public (`/inscription`) → `hospital_requests`
2. Upload de documents de vérification
3. Admin plateforme vérifie les documents
4. Admin approuve → création `hospitals` + compte `lab_manager`
5. Email avec lien de définition du mot de passe (24h valide)

### 2. Choix d'abonnement

1. Nouveau responsable de labo connecté
2. Sélection d'un pack (Essentiel gratuit, Standard 50k XOF, Premium 100k XOF)
3. **Pack gratuit** : Activation immédiate avec période d'essai 7j
4. **Pack payant** : Redirection vers Paystack
5. Paiement réussi → Activation abonnement

### 3. Envoi de résultats médicaux

1. Technicien upload PDF + infos patient
2. Système génère :
   - Code d'accès à 6 chiffres
   - Token d'accès unique
   - PDF protégé par mot de passe
3. Envoi selon canal choisi :
   - **WhatsApp+Email** : Lien par WhatsApp, code par Email
   - **Email+SMS** : Lien par Email, code par SMS
4. Déduction des crédits SMS/WhatsApp si applicable
5. Validité 48h, max 3 tentatives

### 4. Accès patient

1. Patient reçoit lien + code via 2 canaux séparés
2. Accède à `/access/:token`
3. Entre le code à 6 chiffres
4. Après 3 échecs → document bloqué
5. Succès → téléchargement PDF protégé

## Sécurité

### Authentification
- JWT avec cookie httpOnly
- Verrouillage après 3 tentatives échouées (15 min)
- Mot de passe oublié avec token 1h
- Premier mot de passe imposé (`must_change_password`)

### Protection des données
- PDF protégés par mot de passe (pdf-lib)
- Codes d'accès temporaires (48h)
- Séparation stricte des hôpitaux (scoped queries)
- Logs d'activité complets

### Paiement
- Intégration Paystack (devise XOF)
- Webhook avec signature HMAC
- Clés API côté backend uniquement

## API Endpoints principaux

### Authentification (`/api/auth`)
- `POST /login` - Connexion par email
- `POST /register-hospital` - Inscription temporaire
- `POST /forgot-password` - Demande réinitialisation
- `POST /reset-password` - Confirmation réinitialisation

### Hôpitaux (`/api/hospitals`)
- `POST /request` - Demande d'inscription
- `PUT /requests/:id/approve` - Validation admin
- `GET /` - Liste hôpitaux (admin)

### Lab Manager (`/api/lab-manager`)
- `GET /dashboard` - Statistiques hôpital
- `GET /technicians` - Liste techniciens
- `POST /technicians` - Création technicien
- `GET /credits` - Solde crédits

### Upload (`/api/upload`)
- `POST /` - Upload PDF et envoi
- `GET /form-data` - Canaux disponibles

### Patient (`/api/patient`)
- `POST /verify` - Vérification code
- `GET /download/:token` - Téléchargement PDF

### Abonnements (`/api/subscription`)
- `GET /plans` - Packs disponibles
- `POST /choose` - Sélection pack

### Paiement (`/api/payment`)
- `POST /initialize` - Initialisation Paystack
- `GET /verify/:reference` - Vérification paiement
- `POST /webhook` - Webhook Paystack

## Frontend Architecture

### Modules Angular

**Core** :
- Services : auth, admin, upload, subscription, etc.
- Guards : authGuard, roleGuard, SubscriptionGuard
- Modèles : User avec rôles

**Features** :
- `auth/` - Login, forgot password, reset password
- `admin/` - Dashboard, hôpitaux, demandes, plans, subscriptions
- `lab-manager/` - Dashboard, crédits
- `technicien/` - Upload, historique
- `patient/` - Accès patient
- `subscription/` - Choix pack, callback paiement
- `landing/` - Page d'inscription publique

### Routing

Les routes sont protégées par des guards basés sur les rôles :
- `/admin/*` → Admin plateforme uniquement
- `/lab-manager/*` → Responsable de labo + abonnement actif
- `/technicien/*` → Technicien + abonnement actif

## Points clés pour le mémoire

### Innovation technique
1. **Architecture multi-tenancy** : Isolation complète des hôpitaux au niveau BDD
2. **Système de crédits** : Modèle économique basé sur la consommation SMS/WhatsApp
3. **Double canal d'envoi** : Sécurité renforcée par séparation lien/code
4. **Intégration WhatsApp** : Utilisation de Baileys pour automatisation
5. **SaaS avec abonnements** : Modèle freemium + paiement en ligne

### Défis techniques résolus
1. Gestion des connexions WhatsApp persistantes
2. Protection des PDF médicaux avec mots de passe
3. Système de verrouillage anti brute-force
4. Gestion des crédits avec transactions atomiques
5. Webhook Paystack avec vérification de signature

### Évolutivité
- Migration BDD versionnée (001, 002, 003...)
- Architecture modulaire frontend
- Séparation claire des rôles et permissions
- Configuration par hôpital (SMTP, SMS)

## Fichiers clés du projet

### Backend
- `server.js` - Point d'entrée Express
- `config/db.js` - Configuration PostgreSQL
- `routes/auth-route.js` - Authentification
- `routes/hospital-route.js` - Gestion hôpitaux
- `routes/lab-manager-route.js` - Dashboard lab manager
- `routes/upload-route.js` - Upload PDF et envoi
- `routes/patient-route.js` - Accès patient
- `routes/subscription-route.js` - Abonnements
- `routes/payment-route.js` - Paiement Paystack
- `routes/whatsapp-route.js` - Configuration WhatsApp
- `utils/whatsapp.js` - Intégration Baileys
- `utils/sms.js` - Envoi SMS/WhatsApp
- `utils/pdf.js` - Protection PDF
- `utils/credits.js` - Gestion crédits

### Frontend
- `src/app/app.routes.ts` - Configuration routing
- `src/app/core/models/user.ts` - Modèle utilisateur
- `src/app/core/services/` - Services API
- `src/app/core/guards/` - Guards d'authentification
- `src/app/features/admin/` - Interface admin
- `src/app/features/lab-manager/` - Interface lab manager
- `src/app/features/technicien/` - Interface technicien
- `src/app/features/patient/` - Interface patient
- `src/app/features/subscription/` - Choix abonnement

### Migrations
- `migrations/001_multi_hospital.sql` - Architecture multi-hôpitaux
- `migrations/002_identite_technicien.sql` - Prénom/Nom séparés
- `migrations/003_subscriptions.sql` - Système d'abonnements
- `migrations/005_payment_transactions.sql` - Transactions paiement

## Conclusion

Ce projet démontre une maîtrise complète du développement full-stack moderne avec des exigences de sécurité élevées pour le domaine médical. L'architecture multi-tenancy, le système de crédits, et l'intégration de multiples canaux de communication en font une solution SaaS complète et évolutive.
