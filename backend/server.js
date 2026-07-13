import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Allow to register routes 
import cookieParser from 'cookie-parser';
import authRoutes from "./routes/auth-route.js";
import adminRoutes from './routes/admin-route.js';
import hospitalRoutes from './routes/hospital-route.js';
import labManagerRoutes from './routes/lab-manager-route.js';
import profileRoutes from './routes/profile-route.js';
import historyRoutes from './routes/history-route.js';
import uploadRoutes from './routes/upload-route.js';
import patientRoutes from './routes/patient-route.js';
import whatsappRoutes from './routes/whatsapp-route.js';
import subscriptionRoutes from './routes/subscription-route.js';
import paymentRoutes from './routes/payment-route.js';
import * as whatsapp from './utils/whatsapp.js';


const app = express();

// middleware
// Origines autorisées : celle de dev (Angular local) + celle de prod définie dans .env
// (FRONTEND_URL, ex: https://medidoc.myfad.org). En prod, comme le frontend est servi par
// le même Nginx que l'API (voir déploiement), les requêtes sont en général same-origin —
// ce réglage sert surtout de filet de sécurité / pour un accès direct à l'API.
const allowedOrigins = ["http://localhost:4200"];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
/*app.get("/",(req,res)=>{
    res.send("hello World");
});*/
// Toutes les routes définies dans auth.js seront accessibles sous le préfixe /api/auth
// Exemple : router.post('/register') devient ici POST /api/auth/register
app.use('/api/auth',authRoutes);
// Routes admin (niveau plateforme, jamais de données patient)
app.use('/api/admin', adminRoutes);
// Inscription / gestion des hôpitaux (public + admin)
app.use('/api/hospitals', hospitalRoutes);
// Routes responsable de labo (niveau hôpital)
app.use('/api/lab-manager', labManagerRoutes);
// Page Profil (commune aux 3 rôles)
app.use('/api/profile', profileRoutes);
// Route historique
app.use('/api/history', historyRoutes);
// Route upload PDF
app.use('/api/upload', uploadRoutes);
// Patient 
app.use('/api/patient', patientRoutes);
   
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);

const PORT = process.env.PORT || 5000;



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  whatsapp.initConnection().catch(err => {
    console.error(' WhatsApp initialization error:', err.message);
  });
});