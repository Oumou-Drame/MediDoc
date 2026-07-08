export type UserRole = 'admin' | 'lab_manager' | 'technician';
export type ActiveView = 'lab_manager' | 'technician';

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  hospital_id: number | null;
  is_technician: boolean;
  active_view: ActiveView | null;
  must_change_password?: boolean;
  phone?: string | null;
  has_chosen_plan?: boolean;
}

// Rôles "effectifs" d'un utilisateur : un responsable de labo peut cumuler
// la capacité technicien (voir cadrage section 3.4).
export function effectiveRoles(user: CurrentUser | null): UserRole[] {
  if (!user) return [];
  if (user.role === 'lab_manager') {
    return user.is_technician ? ['lab_manager', 'technician'] : ['lab_manager'];
  }
  return [user.role];
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin': return 'Administrateur plateforme';
    case 'lab_manager': return 'Responsable de labo';
    case 'technician': return 'Technicien';
  }
}
