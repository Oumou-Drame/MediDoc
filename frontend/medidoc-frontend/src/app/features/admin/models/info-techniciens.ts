export interface Technicien {
    id: number;
    email: string;
    full_name: string;
    role: string;
    phone: string | null;
    hospital_id: number | null;
    is_active: number;
    created_at: string;
}