import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
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
    });
  }
}
