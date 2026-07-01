export interface LoginResponse {
   user: {
    id: number;
    email: string;
    role: string;
    full_name: string;
    phone: string | null;
    hospital_id: number | null;
  };
}