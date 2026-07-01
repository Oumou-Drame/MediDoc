import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-technicien-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './technicien-layout.html',
  styleUrl: './technicien-layout.css',
})
export class TechnicienLayout implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  nomUtilisateur = '';
  initiales = '';
  userRole = '';
  roleLabel = '';
  sidebarCollapsed = false;

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (user: any) => {
        this.nomUtilisateur = user.full_name || user.email;
        this.userRole = user.role;
        this.roleLabel = this.getRoleLabel(user.role);
        this.initiales = this.nomUtilisateur
          .split(' ')
          .map((mot: string) => mot[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      },
      error: (err: any) => console.error('Erreur récupération utilisateur:', err)
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'technicien': 'Technicien',
      'responsable_labo': 'Responsable de laboratoire'
    };
    return labels[role] || role;
  }

  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
