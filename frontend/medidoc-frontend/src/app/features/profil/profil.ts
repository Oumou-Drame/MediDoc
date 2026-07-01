import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth-service';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  chargement = true;
  enregistrement = false;
  messageSucces = '';
  erreur = '';

  // Tab navigation
  activeTab = 'personal';

  // Profil
  user: any = {};
  editFullName = '';
  editPhone = '';
  editDateNaissance = '';
  avatarInitiales = '';

  // Mot de passe
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordMessage = '';
  passwordError = '';

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (user) => {
        this.user = user;
        this.editFullName = user.full_name || '';
        this.editPhone = user.phone || '';
        this.editDateNaissance = user.date_naissance ? user.date_naissance.substring(0, 10) : '';
        this.avatarInitiales = this.getInitiales(user.full_name);
        this.chargement = false;
      },
      error: () => {
        this.chargement = false;
        this.erreur = 'Impossible de charger le profil';
      }
    });
  }

  getInitiales(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map((m: string) => m[0]).join('').toUpperCase().slice(0, 2);
  }

  enregistrerProfil() {
    this.enregistrement = true;
    this.messageSucces = '';
    this.erreur = '';
    this.authService.updateProfile({
      full_name: this.editFullName,
      phone: this.editPhone,
      date_naissance: this.editDateNaissance || undefined
    }).subscribe({
      next: () => {
        this.enregistrement = false;
        this.messageSucces = 'Profil mis à jour avec succès';
        this.user.full_name = this.editFullName;
        this.user.phone = this.editPhone;
        this.avatarInitiales = this.getInitiales(this.editFullName);
      },
      error: (err) => {
        this.enregistrement = false;
        this.erreur = err.error?.error || 'Erreur lors de la mise à jour';
      }
    });
  }

  changerMotDePasse() {
    this.passwordError = '';
    this.passwordMessage = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Veuillez remplir tous les champs';
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordError = 'Le mot de passe doit contenir au moins 6 caractères';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Les mots de passe ne correspondent pas';
      return;
    }

    this.authService.changePassword({
      current_password: this.currentPassword,
      new_password: this.newPassword
    }).subscribe({
      next: () => {
        this.passwordMessage = 'Mot de passe changé avec succès';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.passwordError = err.error?.error || 'Erreur lors du changement de mot de passe';
      }
    });
  }

  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'responsable_labo': 'Responsable de laboratoire',
      'technicien': 'Technicien'
    };
    return labels[role] || role;
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }
}