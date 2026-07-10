#!/usr/bin/env bash
# ===========================================================
# Script de déploiement MediDoc — à exécuter SUR LE SERVEUR
# (ubuntu@32.194.230.94, domaine medidoc.myfad.org)
# ===========================================================
# Usage : une fois copié sur le serveur (voir GUIDE_DEPLOIEMENT.md),
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Le script pose quelques questions (mot de passe base de données,
# email/mot de passe du compte admin MediDoc, etc.) puis fait tout
# le reste tout seul. Il peut être relancé sans risque si une étape
# échoue (la plupart des commandes sont idempotentes).

set -e  # arrête le script à la première erreur

echo "==================================================="
echo " Déploiement MediDoc — medidoc.myfad.org"
echo "==================================================="
echo

# -----------------------------------------------------------
# 0. Questions
# -----------------------------------------------------------
read -p "Nom de domaine (défaut: medidoc.myfad.org) : " DOMAIN
DOMAIN=${DOMAIN:-medidoc.myfad.org}

read -p "URL du dépôt Git (défaut: https://github.com/Oumou-Drame/MediDoc.git) : " REPO_URL
REPO_URL=${REPO_URL:-https://github.com/Oumou-Drame/MediDoc.git}

read -p "Branche à déployer (défaut: oumou) : " REPO_BRANCH
REPO_BRANCH=${REPO_BRANCH:-oumou}

read -sp "Mot de passe pour l'utilisateur PostgreSQL 'medidoc_user' (choisis-en un, note-le) : " DB_PASSWORD
echo
JWT_SECRET=$(openssl rand -hex 32)

read -p "Email du compte administrateur MediDoc à créer : " ADMIN_EMAIL
read -sp "Mot de passe du compte administrateur (8 caractères min) : " ADMIN_PASSWORD
echo
read -p "Nom complet de l'administrateur : " ADMIN_NAME

APP_DIR="/var/www/medidoc"

echo
echo ">>> Toutes les infos sont enregistrées, le déploiement démarre (ça prend quelques minutes)..."
echo

# -----------------------------------------------------------
# 1. Prérequis système
# -----------------------------------------------------------
echo ">>> [1/9] Installation des paquets système..."
sudo apt update -y
sudo apt install -y curl git build-essential ufw

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js : $(node -v)"

if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
fi
sudo systemctl enable postgresql --now

if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
fi
sudo systemctl enable nginx --now

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# -----------------------------------------------------------
# 2. Pare-feu
# -----------------------------------------------------------
echo ">>> [2/9] Configuration du pare-feu..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# -----------------------------------------------------------
# 3. Base de données PostgreSQL
# -----------------------------------------------------------
echo ">>> [3/9] Configuration de la base de données..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='medidoc_user'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER medidoc_user WITH PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='medidoc'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE medidoc OWNER medidoc_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medidoc TO medidoc_user;"

# -----------------------------------------------------------
# 4. Récupération du code
# -----------------------------------------------------------
echo ">>> [4/9] Récupération du code depuis GitHub..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git fetch origin
    git checkout "$REPO_BRANCH"
    git pull origin "$REPO_BRANCH"
else
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER":"$USER" "$APP_DIR"
    git clone -b "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# -----------------------------------------------------------
# 5. Backend
# -----------------------------------------------------------
echo ">>> [5/9] Installation du backend..."
cd "$APP_DIR/backend"
npm install --omit=dev

cat > .env << EOF
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=medidoc_user
DB_NAME=medidoc
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
CLIENT_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
CODE_EXPIRATION_HOURS=48
# Configuration SMTP : ne rien mettre ici — elle se configure depuis
# l'interface admin (Paramètres > Configuration SMTP plateforme) une
# fois le site en ligne, et est enregistrée en base de données.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
# SMS / WhatsApp / paiement : à compléter plus tard si besoin (facultatif,
# le site fonctionne sans — les envois SMS/paiement seront simulés).
TERMII_API_KEY=
TERMII_SENDER_ID=
TERMII_CHANNEL=dnd
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PAYSTACK_SECRET_KEY=
EOF

echo ">>> Exécution des migrations..."
for f in $(ls migrations/*.sql | sort); do
    echo "  -> $f"
    node scripts/run-migration.js "$f"
done

echo ">>> Création du compte administrateur..."
node scripts/create-platform-admin.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_NAME" || \
    echo "   (le compte existe peut-être déjà — pas bloquant)"

# -----------------------------------------------------------
# 6. Frontend
# -----------------------------------------------------------
echo ">>> [6/9] Build du frontend Angular (peut prendre 2-3 minutes)..."
cd "$APP_DIR/frontend/medidoc-frontend"
npm install
npx ng build --configuration production

FRONTEND_DIST="$APP_DIR/frontend/medidoc-frontend/dist/medidoc-frontend/browser"
if [ ! -d "$FRONTEND_DIST" ]; then
    # certaines versions d'Angular n'ajoutent pas le sous-dossier /browser
    FRONTEND_DIST="$APP_DIR/frontend/medidoc-frontend/dist/medidoc-frontend"
fi

# -----------------------------------------------------------
# 7. Nginx
# -----------------------------------------------------------
echo ">>> [7/9] Configuration de Nginx..."
sudo tee /etc/nginx/sites-available/medidoc > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 60M;

    root ${FRONTEND_DIST};
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/medidoc /etc/nginx/sites-enabled/medidoc
sudo nginx -t
sudo systemctl reload nginx

# -----------------------------------------------------------
# 8. Démarrage du backend avec PM2
# -----------------------------------------------------------
echo ">>> [8/9] Démarrage du backend..."
cd "$APP_DIR/backend"
pm2 delete medidoc-backend 2>/dev/null || true
pm2 start server.js --name medidoc-backend
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 > /tmp/pm2_startup_cmd.sh
bash /tmp/pm2_startup_cmd.sh || true

# -----------------------------------------------------------
# 9. Résumé
# -----------------------------------------------------------
echo ">>> [9/9] Terminé !"
echo
echo "==================================================="
echo " Le site devrait être accessible sur :"
echo "   http://${DOMAIN}"
echo
echo " Compte admin : ${ADMIN_EMAIL}"
echo
echo " Prochaines étapes (à faire depuis le site, une fois connectée) :"
echo "  1. Paramètres > Configuration SMTP plateforme (voir guide précédent)"
echo "  2. Activer le HTTPS : sudo apt install -y certbot python3-certbot-nginx"
echo "     puis : sudo certbot --nginx -d ${DOMAIN}"
echo "  3. Reconnecter WhatsApp : ouvrir https://${DOMAIN}/api/whatsapp/qr"
echo "     et scanner le QR code avec le téléphone qui sert de compte plateforme."
echo "==================================================="
