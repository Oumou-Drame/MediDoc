import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';
import { LoginRequest } from '../models/LoginRequest';
import { LoginResponse } from '../models/LoginResponse';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email: string = '';
  password: string = '';
  motDePasseVisible = false;
  erreur = '';
  connexionEnCours = false;
  router: Router = inject(Router);
  authService: AuthService = inject(AuthService);
  loginRequest: LoginRequest = { email: '', password: '' };

  basculerVisibiliteMotDePasse() {
    this.motDePasseVisible = !this.motDePasseVisible;
  }

  connection() {
    this.erreur = '';
    this.loginRequest.email = this.email;
    this.loginRequest.password = this.password;

    this.connexionEnCours = true;
    this.authService.login(this.loginRequest).subscribe({
      next: (value: LoginResponse) => {
        this.connexionEnCours = false;
        const user = value.user;

        // Si lab_manager et n'a pas encore choisi de pack → page choix abonnement
        if (user.role === 'lab_manager' && !user.has_chosen_plan) {
          this.router.navigateByUrl('/choix-abonnement');
          return;
        }

        // Compte cumulant responsable de labo + technicien : on respecte la dernière vue choisie.
        const veutVueTechnicien = user.role === 'lab_manager' && user.is_technician && user.active_view === 'technician';

        if (user.role === 'admin') {
          this.router.navigateByUrl('/admin/hopitaux');
        } else if (user.role === 'lab_manager' && !veutVueTechnicien) {
          this.router.navigateByUrl('/lab-manager/dashboard');
        } else {
          this.router.navigateByUrl('/technicien');
        }
      },
      error: (err) => {
        this.connexionEnCours = false;
        this.erreur = err.error?.message || 'Email ou mot de passe incorrects';
      },
    });
  }

  forgotPassword() {
    this.router.navigateByUrl('/forgot-password');
  }
}
