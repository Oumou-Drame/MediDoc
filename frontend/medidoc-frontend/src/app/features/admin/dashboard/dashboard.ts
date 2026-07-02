import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { AdminService } from '../../../core/services/admin-service';
import { AuthService } from '../../../core/services/auth-service';
import { DashboardStats } from '../models/dashbord-stats';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  stats: DashboardStats | null = null;

  nomUtilisateur = '';

  get prenomUtilisateur(): string {
    return this.nomUtilisateur.split(' ')[0] || this.nomUtilisateur;
  }

  get dateAujourdhui(): Date {
    return new Date();
  }

  ngOnInit(): void {
    if (this.authService.currentUser) {
      this.nomUtilisateur = this.authService.currentUser.full_name;
    } else {
      this.authService.getMe().subscribe({ next: (u) => { this.nomUtilisateur = u.full_name; } });
    }

    this.adminService.getDashboard().subscribe({
      next: (res) => { this.stats = res.data; },
      error: (err) => console.error('Erreur chargement dashboard:', err)
    });
  }

  initiales(nom: string): string {
    return nom.split(' ').map(mot => mot[0]).join('').toUpperCase().slice(0, 2);
  }
  // Limiter le nombre de techniciens qui apparait au niveau du dashboard à 5
  get techniciensAffiches() {
    return this.stats?.techniciens.slice(0, 5) || [];
  }

  get maxTendance(): number {
    if (!this.stats?.tendance_7_jours?.length) return 1;
    return Math.max(...this.stats.tendance_7_jours.map(j => j.count), 1);
  }

  hauteurBarre(count: number): number {
    return Math.max((count / this.maxTendance) * 100, count > 0 ? 6 : 2);
  }
}