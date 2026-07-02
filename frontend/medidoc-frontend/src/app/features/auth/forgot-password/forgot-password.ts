import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
<<<<<<< HEAD
import { Router, RouterLink } from '@angular/router';
=======
import { RouterLink } from '@angular/router';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
<<<<<<< HEAD
  styleUrl: './forgot-password.css',
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  successMessage = '';
  errorMessage = '';

  private authService = inject(AuthService);

  onSubmit() {
    if (!this.email) return;

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message || 'Un lien de réinitialisation a été envoyé à votre adresse email.';
        this.email = '';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error || 'Une erreur est survenue. Veuillez réessayer.';
      }
=======
  styleUrl: '../login/login.css',
})
export class ForgotPassword {
  private authService = inject(AuthService);

  email = '';
  envoiEnCours = false;
  messageEnvoye = false;

  envoyer() {
    if (!this.email.trim()) return;
    this.envoiEnCours = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => { this.envoiEnCours = false; this.messageEnvoye = true; },
      error: () => { this.envoiEnCours = false; this.messageEnvoye = true; } // même message par sécurité (ne pas révéler si l'email existe)
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    });
  }
}
