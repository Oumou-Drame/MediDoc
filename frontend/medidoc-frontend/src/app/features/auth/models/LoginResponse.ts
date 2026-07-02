import { CurrentUser } from '../../../core/models/user';

export interface LoginResponse {
<<<<<<< HEAD
   user: {
    id: number;
    email: string;
    role: string;
    full_name: string;
    phone: string | null;
    hospital_id: number | null;
  };
=======
  user: CurrentUser;
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
}