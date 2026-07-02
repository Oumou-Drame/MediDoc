export interface Technicien {
    id: number;
    email: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    date_naissance: string | null;
    role: string;
    phone: string | null;
    hospital_id: number | null;
    is_active: number;
    created_at: string;
}