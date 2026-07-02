import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
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
  router: Router = inject(Router);
  AuthService: AuthService = inject(AuthService);
  LoginRequest: LoginRequest = { email: '', password: '' };

  basculerVisibiliteMotDePasse() {
    this.motDePasseVisible = !this.motDePasseVisible;
  }

  connection() {
    this.LoginRequest.email = this.email;
    this.LoginRequest.password = this.password;

    this.AuthService.login(this.LoginRequest).subscribe({
      next: (value: LoginResponse) => {
        const user = value.user;

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
        console.log(err);
        alert(err.error?.message || 'Email ou mot de passe incorrect');
      },
      complete() {
        console.log('Authentification terminée');
      }
    });
  }
}
