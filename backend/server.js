import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Allow to register routes 
import cookieParser from 'cookie-parser';
import authRoutes from "./routes/auth-route.js";
import adminRoutes from './routes/admin-route.js';
import historyRoutes from './routes/history-route.js';
import uploadRoutes from './routes/upload-route.js';
import patientRoutes from './routes/patient-route.js';
import whatsappRoutes from './routes/whatsapp-route.js';
import { initConnection } from './utils/whatsapp.js';

const app = express();

// middleware
app.use(cors({
    origin: "http://localhost:4200",
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
// Routes admin
app.use('/api/admin', adminRoutes);
// Route historique
app.use('/api/history', historyRoutes);
// Route upload PDF
app.use('/api/upload', uploadRoutes);
// Patient 
app.use('/api/patient', patientRoutes);
   
app.use('/api/whatsapp', whatsappRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('📱 WhatsApp géré via Baileys (WhatsApp Web)');
  console.log('� SMS géré via Twilio');
  console.log('📱 Email géré via SMTP');
  
  // Initialiser la connexion WhatsApp Baileys au démarrage
  initConnection().catch(err => {
    console.error('❌ Erreur initialisation WhatsApp Baileys:', err.message);
  });
});