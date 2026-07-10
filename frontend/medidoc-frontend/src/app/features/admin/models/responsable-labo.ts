export interface ResponsableLabo {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: number;
  is_technician: boolean;
  created_at: string;
  hospital_id: number;
  hospital_name: string;
}
