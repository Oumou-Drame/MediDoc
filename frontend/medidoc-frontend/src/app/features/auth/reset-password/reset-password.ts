import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
<<<<<<< HEAD
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
=======
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
<<<<<<< HEAD
  styleUrl: './reset-password.css',
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  
  loading = false;
  successMessage = '';
  errorMessage = '';

=======
  styleUrl: '../login/login.css',
})
export class ResetPassword implements OnInit {
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

<<<<<<< HEAD
  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMessage = 'Le lien de réinitialisation est invalide ou manquant.';
    }
  }

  onSubmit() {
    if (!this.token) return;

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message || 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.error || 'Ce lien a expiré ou est invalide.';
=======
  token = '';
  password = '';
  confirmPassword = '';
  motDePasseVisible = false;
  enregistrementEnCours = false;
  erreur = '';
  succes = false;

  basculerVisibiliteMotDePasse() {
    this.motDePasseVisible = !this.motDePasseVisible;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
  }

  valider() {
    this.erreur = '';
    if (this.password !== this.confirmPassword) {
      this.erreur = 'Les mots de passe ne correspondent pas';
      return;
    }
    if (this.password.length < 8) {
      this.erreur = 'Le mot de passe doit contenir au moins 8 caractères';
      return;
    }

    this.enregistrementEnCours = true;
    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.enregistrementEnCours = false;
        this.succes = true;
        setTimeout(() => this.router.navigateByUrl('/login'), 2500);
      },
      error: (err) => {
        this.enregistrementEnCours = false;
        this.erreur = err.error?.error || 'Lien invalide ou expiré';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
      }
    });
  }
}
