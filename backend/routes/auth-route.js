import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import {protect} from '../middleware/auth-middleware.js';

const router = express.Router();
const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 *  60 * 1000 // 30day
};

const generateToken = (id) =>{
    return jwt.sign({id},process.env.JWT_SECRET,{
        expiresIn: '30d'
    });
};

// Login // POST /api/auth/login — Connexion d'un utilisateur existant
router.post('/login', async(req,res) =>{
    const {username, password} = req.body;
    if(!username || !password){
        return res.status(400).json({message: 'Please provide all required fields'});
    }
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if(user.rows.length === 0){
        return res.status(400).json({message : 'Invalid credentials'});
    }

    const userData = user.rows[0];
    const isMatch = await bcrypt.compare(password,userData.password);
    if(!isMatch){
        return res.status(400).json({message: 'Invalid credentials'});
    }

    const token = generateToken(userData.id);
    res.cookie('token', token, cookieOptions);
    res.json({
        user: {id:userData.id,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            full_name: userData.full_name
        }
    });
}
);

//  Me // GET /api/auth/me — Récupère les infos de l'utilisateur connecté
router.get('/me',protect,async (req,res) =>{
    res.json(req.user);
    // Return  info if the logged un user from protect middleware
});

// Logout // POST /api/auth/logout — Déconnexion (supprime le cookie token)
router.post('/logout', (req,res) =>{
    res.cookie('token','',{...cookieOptions,maxAge: 1});
    res.json({message: 'loggout successfully'})
});

export default router;
