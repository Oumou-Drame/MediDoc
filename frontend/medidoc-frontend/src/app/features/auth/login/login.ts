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
  loading: boolean = false;
  errorMessage: string = '';
  emailFocused: boolean = false;
  passwordFocused: boolean = false;
  router: Router = inject(Router);
  authService: AuthService = inject(AuthService);
  loginRequest: LoginRequest = {email: '', password: ''};

  basculerVisibiliteMotDePasse() {
    this.motDePasseVisible = !this.motDePasseVisible;
  }

  connection() {
    // Reset error
    this.errorMessage = '';
    
    // Basic validation
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.loading = true;
    this.loginRequest.email = this.email;
    this.loginRequest.password = this.password;

    this.authService.login(this.loginRequest).subscribe({
      next: (value: LoginResponse) => {
        this.loading = false;
        const role = value.user.role;
        if (role === 'responsable_labo' || role === 'admin') {
          this.router.navigateByUrl('/admin/dashboard');
        } else if (role === 'technicien') {
          this.router.navigateByUrl('/technicien');
        }
      },
      error: (err) => {
        this.loading = false;
        console.log(err);
        if (err.status === 400) {
          this.errorMessage = 'Email ou mot de passe incorrect';
        } else if (err.status === 0) {
          this.errorMessage = 'Impossible de se connecter au serveur';
        } else {
          this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
        }
      },
    });
  }

  forgotPassword() {
    this.router.navigateByUrl('/forgot-password');
  }
}