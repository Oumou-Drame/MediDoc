export interface LoginResponse {
   user: {
    id: number;
    email: string;
    role: string;
    full_name: string;
    phone: string | null;
    matricule: string | null;
    date_naissance: string | null;
  };
}