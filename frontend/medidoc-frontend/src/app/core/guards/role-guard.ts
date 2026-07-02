import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth-service';
import { effectiveRoles, UserRole } from '../models/user';
import { map, catchError, of } from 'rxjs';

// Redirige vers l'espace qui correspond au rôle réel de l'utilisateur (au lieu d'afficher
// une page vide en attendant le 403 de l'API) — voir cadrage : chaque rôle ne doit voir
// que ce qui lui est propre.
function redirectionParDefaut(roles: UserRole[]): string {
    if (roles.includes('admin')) return '/admin/hopitaux';
    if (roles.includes('lab_manager')) return '/lab-manager/dashboard';
    if (roles.includes('technician')) return '/technicien';
    return '/login';
}

export function roleGuard(rolesAutorises: UserRole[]): CanActivateFn {
    return () => {
        const authService = inject(AuthService);
        const router = inject(Router);

        return authService.getMe().pipe(
            map((user) => {
                const roles = effectiveRoles(user);
                const autorise = rolesAutorises.some(r => roles.includes(r));
                if (autorise) return true;
                router.navigateByUrl(redirectionParDefaut(roles));
                return false;
            }),
            catchError(() => {
                router.navigateByUrl('/login');
                return of(false);
            })
        );
    };
}
