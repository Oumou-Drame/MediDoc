export interface Technicien {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: string;
    phone: string | null;
    is_active: number;
    created_at: string;
}