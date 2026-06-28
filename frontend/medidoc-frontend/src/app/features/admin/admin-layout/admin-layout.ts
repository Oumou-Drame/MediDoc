import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  nomUtilisateur = '';
  initiales = '';

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (user: any) => {
        this.nomUtilisateur = user.full_name || user.username;
        this.initiales = this.nomUtilisateur
          .split(' ')
          .map((mot: string) => mot[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      },
      error: (err) => console.error('Erreur récupération utilisateur:', err)
    });
  }
  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')   // même en cas d'erreur réseau, on renvoie vers /login
    });
  }
}