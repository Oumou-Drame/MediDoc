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
  loading: boolean = false;
  errorMessage: string = '';
  motDePasseVisible = false;
  emailFocused = false;
  passwordFocused = false;
  router: Router = inject(Router);
  AuthService: AuthService = inject(AuthService);
  LoginRequest: LoginRequest = { email: '', password: '' };

  basculerVisibiliteMotDePasse() {
    this.motDePasseVisible = !this.motDePasseVisible;
  }

  connection() {
    this.errorMessage = '';
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }
    this.loading = true;
    this.LoginRequest.email = this.email;
    this.LoginRequest.password = this.password;

    this.AuthService.login(this.LoginRequest).subscribe({
      next: (value: LoginResponse) => {
        this.loading = false;
        const role = value.user.role;
        if (role === 'lab_manager' || role === 'admin') {
          this.router.navigateByUrl('/admin/dashboard');
        } else if (role === 'technician') {
          this.router.navigateByUrl('/technicien');
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 400) {
          this.errorMessage = 'Email ou mot de passe incorrect';
        } else if (err.status === 0) {
          this.errorMessage = 'Impossible de se connecter au serveur';
        } else {
          this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
        }
      }
    });
  }

  forgotPassword() {
    this.router.navigateByUrl('/forgot-password');
  }
}
