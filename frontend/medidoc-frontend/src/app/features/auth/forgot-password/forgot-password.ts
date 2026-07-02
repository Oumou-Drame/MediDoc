import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
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
    });
  }
}
