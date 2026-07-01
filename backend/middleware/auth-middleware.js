import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Not authorized, no token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query("SELECT id, email, role, full_name, phone, hospital_id, is_active FROM users WHERE id = $1", [decoded.id]);
        if (user.rows.length === 0) {
            return res.status(401).json({ message: "Not authorized, user not found" });
        }
        if (!user.rows[0].is_active) {
            return res.status(403).json({ message: "Compte désactivé. Contactez l'administrateur." });
        }
        req.user = user.rows[0];
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: "Not authorized, token failed" });
    }
}

export const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux administrateurs globaux" });
};

export const requireResponsableLabo = (req, res, next) => {
    if (req.user && req.user.role === 'responsable_labo') {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux responsables de laboratoire" });
};

export const requireTechnician = (req, res, next) => {
    if (req.user && (req.user.role === 'technicien' || req.user.role === 'responsable_labo')) {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux techniciens" });
};
