import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Not authorized, no token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query("SELECT id, username,email,role,full_name FROM users WHERE id = $1", [decoded.id]);
        if (user.rows.length === 0) {
            return res.status(401).json({ message: "Not authorized, user not found" });

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
    return res.status(403).json({ message: "Accès interdit : réservé aux administrateurs" });
};

export const requireTechnician = (req, res, next) => {
    if (req.user && req.user.role === 'technician') {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux techniciens" });
};