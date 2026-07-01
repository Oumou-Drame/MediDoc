export interface Technicien {
    id: number;
    email: string;
    full_name: string;
    role: string;
    phone: string | null;
    matricule: string | null;
    date_naissance: string | null;
    is_active: number;
    created_at: string;
}