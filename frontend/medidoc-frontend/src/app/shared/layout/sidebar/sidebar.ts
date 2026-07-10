import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';
import { ProfileService } from '../../../core/services/profile-service';
import { CurrentUser, effectiveRoles, roleLabel, ActiveView } from '../../../core/models/user';

interface NavItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'accounts' | 'history' | 'settings' | 'upload' | 'hospitals' | 'requests' | 'credits' | 'activity';
}

// Nav propre à chaque rôle effectif (voir cadrage section 5 : "Un seul composant réutilisable,
// dont le contenu s'adapte au rôle et au mode de vue choisi pour les comptes à double capacité").
const NAV_BY_ROLE: Record<string, NavItem[]> = {
  admin: [
    { label: 'Structures de santé', route: '/admin/hopitaux', icon: 'hospitals' },
    { label: "Demandes d'inscription", route: '/admin/demandes', icon: 'requests' },
    { label: 'Responsables de labo', route: '/admin/responsables-labo', icon: 'accounts' },
    { label: 'Crédits', route: '/admin/credits', icon: 'credits' },
    { label: 'Paramètres plateforme', route: '/admin/parametres', icon: 'settings' },
  ],
  lab_manager: [
    { label: 'Dashboard', route: '/lab-manager/dashboard', icon: 'dashboard' },
    { label: 'Comptes techniciens', route: '/lab-manager/comptes', icon: 'accounts' },
    { label: 'Historique', route: '/lab-manager/historique', icon: 'history' },
    { label: "Journal d'activité", route: '/lab-manager/activite', icon: 'activity' },
    { label: 'Crédits', route: '/lab-manager/credits', icon: 'credits' },
  ],
  technician: [
    { label: 'Nouvel envoi', route: '/technicien', icon: 'upload' },
    { label: 'Mes envois', route: '/technicien/historique', icon: 'history' },
  ],
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  private authService = inject(AuthService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  user: CurrentUser | null = null;
  sidebarReplie = false;
  menuMobileOuvert = false;

  ngOnInit(): void {
    const sauvegarde = localStorage.getItem('sidebar_repliee');
    this.sidebarReplie = sauvegarde === 'true';

    // Si l'utilisateur est déjà en cache (login récent), on l'utilise tout de suite,
    // sinon on va le chercher (rechargement de page).
    if (this.authService.currentUser) {
      this.user = this.authService.currentUser;
    } else {
      this.authService.getMe().subscribe({
        next: (user) => { this.user = user; },
        error: (err) => console.error('Erreur récupération utilisateur:', err)
      });
    }
  }

  get initiales(): string {
    if (!this.user?.full_name) return '';
    return this.user.full_name.split(' ').map(m => m[0]).join('').toUpperCase().slice(0, 2);
  }

  get roles(): string[] {
    return effectiveRoles(this.user);
  }

  get roleAffiche(): string {
    return this.user ? roleLabel(this.user.role) : '';
  }

  get cumuleRoles(): boolean {
    return this.roles.length > 1;
  }

  // Nav affichée : dépend du rôle, et de la vue active pour les comptes à double capacité.
  get navItems(): NavItem[] {
    if (!this.user) return [];
    if (this.cumuleRoles) {
      const vue: ActiveView = this.user.active_view || 'lab_manager';
      return NAV_BY_ROLE[vue] || [];
    }
    return NAV_BY_ROLE[this.user.role] || [];
  }

  basculerSidebar() {
    this.sidebarReplie = !this.sidebarReplie;
    localStorage.setItem('sidebar_repliee', String(this.sidebarReplie));
  }

  basculerMenuMobile() {
    this.menuMobileOuvert = !this.menuMobileOuvert;
  }

  fermerMenuMobile() {
    this.menuMobileOuvert = false;
  }

  // Switch de vue mémorisé côté serveur (cadrage section 3.4) : pas redemandé à la prochaine connexion.
  changerVue(vue: ActiveView) {
    if (!this.user || vue === this.user.active_view) return;
    this.profileService.switchView(vue).subscribe({
      next: () => {
        this.user = { ...this.user!, active_view: vue };
        this.router.navigateByUrl(vue === 'technician' ? '/technicien' : '/lab-manager/dashboard');
      },
      error: (err) => alert(err.error?.error || 'Erreur lors du changement de vue')
    });
  }

  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }
}
