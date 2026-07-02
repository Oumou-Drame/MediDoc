export interface Technicien {
    id: number;
    nom: string;
    email: string;
    en_ligne: boolean;
}

export interface Canal {
    nom: string;
    pourcentage: number;
    classe: string;
}

export interface DashboardStats {
    techniciens_total: number;
    techniciens_actifs: number;
    envois_ce_mois: number;
    taux_consultation: number;
    codes_expires: number;
    techniciens: Technicien[];
    canaux: Canal[];
}

export interface DashboardResponse {
    success: boolean;
    data: DashboardStats;
}

export interface ActiviteRecente {
    action: string;
    details: string;
    auteur: string;
    date: string;
}

export interface TendanceJour {
    date: string;
    count: number;
}

export interface DashboardStats {
    techniciens_actifs: number;
    techniciens_total: number;
    envois_ce_mois: number;
    taux_consultation: number;
    codes_expires: number;
    techniciens: Technicien[];
    canaux: Canal[];
    activite_recente: ActiviteRecente[];
    tendance_7_jours: TendanceJour[];
    solde_credits: number;
}