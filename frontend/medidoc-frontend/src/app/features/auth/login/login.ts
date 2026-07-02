<<<<<<< HEAD
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
=======
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
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
<<<<<<< HEAD
   email: string = '';
   password: string = '';
   loading: boolean = false;
   errorMessage: string = '';
   emailFocused: boolean = false;
   passwordFocused: boolean = false;
   router: Router = inject(Router);
   authService: AuthService = inject(AuthService);
   loginRequest: LoginRequest = {email: '', password: ''}

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
=======
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
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
          this.router.navigateByUrl('/technicien');
        }
      },
      error: (err) => {
<<<<<<< HEAD
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
=======
        console.log(err);
        alert(err.error?.message || 'Email ou mot de passe incorrect');
      },
      complete() {
        console.log('Authentification terminée');
      }
    });
  }
}
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
