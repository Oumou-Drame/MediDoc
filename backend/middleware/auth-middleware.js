import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

// Rôles "effectifs" d'un utilisateur : un responsable de labo peut cumuler
// la capacité technicien (voir section 3.4 du cadrage multi-hôpitaux).
export function effectiveRoles(user) {
    if (!user) return [];
    if (user.role === 'lab_manager') {
        return user.is_technician ? ['lab_manager', 'technician'] : ['lab_manager'];
    }
    return [user.role];
}

export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Not authorized, no token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query(
            `SELECT id, email, full_name, role, phone, hospital_id, is_technician, active_view,
                    must_change_password, is_active
             FROM users WHERE id = $1`,
            [decoded.id]
        );
        if (user.rows.length === 0) {
            return res.status(401).json({ message: "Not authorized, user not found" });
        }
        if (!user.rows[0].is_active) {
            return res.status(403).json({ message: "Compte désactivé" });
        }
        req.user = user.rows[0];
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: "Not authorized, token failed" });
    }
};

// Réservé au strict niveau plateforme (aucune donnée patient, aucun hospital_id)
export const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux administrateurs" });
};

// Réservé au responsable de labo (gère son propre hôpital)
export const requireLabManager = (req, res, next) => {
    if (req.user && effectiveRoles(req.user).includes('lab_manager')) {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux responsables de labo" });
};

// Technicien "pur" OU responsable de labo ayant activé la capacité technicien
export const requireTechnician = (req, res, next) => {
    if (req.user && effectiveRoles(req.user).includes('technician')) {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux techniciens" });
};

// Tout utilisateur rattaché à un hôpital (lab_manager et/ou technicien), jamais l'admin plateforme
export const requireHospitalUser = (req, res, next) => {
    if (req.user && req.user.hospital_id) {
        return next();
    }
    return res.status(403).json({ message: "Accès interdit : réservé aux comptes d'un hôpital" });
};
