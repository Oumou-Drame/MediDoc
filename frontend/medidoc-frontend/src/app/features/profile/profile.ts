import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService, ProfileData } from '../../core/services/profile-service';
import { PreferencesService, TaillePolice } from '../../core/services/preferences-service';
import { AuthService } from '../../core/services/auth-service';
import { roleLabel, UserRole, ActiveView } from '../../core/models/user';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private profileService = inject(ProfileService);
  private preferencesService = inject(PreferencesService);
  private authService = inject(AuthService);

  tailleActuelle: TaillePolice = this.preferencesService.tailleActuelle;
  taillesDisponibles: { valeur: TaillePolice; label: string }[] = [
    { valeur: 'petite', label: 'Petite' },
    { valeur: 'moyenne', label: 'Moyenne' },
    { valeur: 'grande', label: 'Grande' },
  ];

  changerTaillePolice(taille: TaillePolice) {
    this.tailleActuelle = taille;
    this.preferencesService.definirTaille(taille);
  }

  chargement = true;
  profil: ProfileData | null = null;

  // Formulaire infos personnelles
  fullName = '';
  phone = '';
  enregistrementInfos = false;
  messageInfos = '';

  // Formulaire changement de mot de passe
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  enregistrementMdp = false;
  messageMdp = '';
  erreurMdp = '';

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.profil = res.data;
        this.fullName = res.data.full_name;
        this.phone = res.data.phone || '';
        this.chargement = false;
      },
      error: (err) => {
        console.error('Erreur chargement profil:', err);
        this.chargement = false;
      }
    });
  }

  get initiales(): string {
    if (!this.profil?.full_name) return '';
    return this.profil.full_name.split(' ').map(m => m[0]).join('').toUpperCase().slice(0, 2);
  }

  get badgesRole(): string[] {
    if (!this.profil) return [];
    return this.profil.roles.map(r => roleLabel(r as UserRole));
  }

  // Un compte responsable de labo peut aussi avoir la capacité technicien (cadrage section 3.4) :
  // switch de vue accessible ici aussi, en plus de la sidebar.
  get cumuleRoles(): boolean {
    return !!this.profil && this.profil.roles.length > 1;
  }

  changerVue(vue: ActiveView) {
    if (!this.profil || vue === this.profil.active_view) return;
    this.profileService.switchView(vue).subscribe({
      next: () => {
        this.profil = { ...this.profil!, active_view: vue };
        this.authService.updateCurrentUser({ active_view: vue });
      },
      error: (err) => alert(err.error?.error || 'Erreur lors du changement de vue')
    });
  }

  // Un responsable de labo peut activer/désactiver lui-même sa capacité technicien.
  get estResponsableLabo(): boolean {
    return this.profil?.role === 'lab_manager';
  }

  enregistrementCapacite = false;

  changerCapaciteTechnicien(active: boolean) {
    if (!this.profil || this.enregistrementCapacite) return;
    this.enregistrementCapacite = true;
    this.profileService.toggleTechnicianCapacity(active).subscribe({
      next: (res) => {
        this.enregistrementCapacite = false;
        this.profil = {
          ...this.profil!,
          is_technician: res.is_technician,
          active_view: res.active_view,
          roles: res.is_technician ? ['lab_manager', 'technician'] : ['lab_manager']
        };
        this.authService.updateCurrentUser({ is_technician: res.is_technician, active_view: res.active_view });
      },
      error: (err) => {
        this.enregistrementCapacite = false;
        alert(err.error?.error || 'Erreur lors du changement de capacité');
      }
    });
  }

  enregistrerInfos() {
    if (!this.fullName.trim()) return;
    this.enregistrementInfos = true;
    this.messageInfos = '';
    this.profileService.updateProfile({ full_name: this.fullName, phone: this.phone }).subscribe({
      next: () => {
        this.enregistrementInfos = false;
        this.messageInfos = 'Profil mis à jour avec succès';
        this.charger();
      },
      error: (err) => {
        this.enregistrementInfos = false;
        alert(err.error?.error || "Erreur lors de la mise à jour du profil");
      }
    });
  }

  changerMotDePasse() {
    this.erreurMdp = '';
    this.messageMdp = '';

    if (this.newPassword !== this.confirmPassword) {
      this.erreurMdp = 'Les mots de passe ne correspondent pas';
      return;
    }
    if (this.newPassword.length < 8) {
      this.erreurMdp = 'Le nouveau mot de passe doit contenir au moins 8 caractères';
      return;
    }

    this.enregistrementMdp = true;
    this.profileService.changePassword({
      current_password: this.currentPassword,
      new_password: this.newPassword,
      confirm_password: this.confirmPassword
    }).subscribe({
      next: () => {
        this.enregistrementMdp = false;
        this.messageMdp = 'Mot de passe modifié avec succès';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.enregistrementMdp = false;
        this.erreurMdp = err.error?.error || 'Erreur lors du changement de mot de passe';
      }
    });
  }
}
