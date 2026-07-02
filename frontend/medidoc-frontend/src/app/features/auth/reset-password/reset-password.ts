import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.css',
})
export class ResetPassword implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
      }
    });
  }
}
