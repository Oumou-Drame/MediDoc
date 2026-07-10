import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-inscription',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inscription.html',
  styleUrl: './inscription.css'
})
export class Inscription {
  private http = inject(HttpClient);
  private router = inject(Router);

  // Infos établissement
  hospitalName = '';
  contactName = '';
  contactEmail = '';
  contactPhone = '';
  address = '';
  numeroAgrement = '';
  message = '';
  accepteConditions = false;

  // Document de vérification
  selectedFile: File | null = null;
  documentType = 'agreement'; // agreement, license, registration, other
  uploadEnCours = false;
  requestId: number | null = null;

  envoiEnCours = false;
  erreur = '';
  erreurChamp: Record<string, string> = {};
  envoye = false;

  // Formulaire en 2 étapes : établissement/contact, puis document + conditions.
  // Rend le formulaire moins intimidant qu'une longue page unique.
  etapeCourante = 1;

  validerEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  validerTelephone(phone: string): boolean {
    if (!phone) return true;
    return /^\+?[0-9\s-]{8,}$/.test(phone);
  }

  get maxMessageLength(): number {
    return 500;
  }

  get messageLength(): number {
    return this.message.length;
  }

  champEstInvalide(nom: string): boolean {
    return !!this.erreurChamp[nom];
  }

  // Valide uniquement les champs de l'étape 1 (établissement + contact) avant de passer à l'étape 2.
  validerEtape1(): boolean {
    this.erreur = '';
    this.erreurChamp = {};

    const champsRequis = [
      { nom: 'hospitalName', valeur: this.hospitalName.trim(), libelle: "Nom de l'établissement" },
      { nom: 'numeroAgrement', valeur: this.numeroAgrement.trim(), libelle: "Numéro d'agrément / licence" },
      { nom: 'contactName', valeur: this.contactName.trim(), libelle: 'Nom du contact' },
      { nom: 'contactEmail', valeur: this.contactEmail.trim(), libelle: 'Email du contact' }
    ];

    let erreursTrouvees = false;

    for (const champ of champsRequis) {
      if (!champ.valeur) {
        this.erreurChamp[champ.nom] = `${champ.libelle} est requis`;
        erreursTrouvees = true;
      }
    }

    if (!erreursTrouvees && !this.validerEmail(this.contactEmail)) {
      this.erreurChamp['contactEmail'] = 'Email invalide';
      erreursTrouvees = true;
    }

    if (!erreursTrouvees && !this.validerTelephone(this.contactPhone)) {
      this.erreurChamp['contactPhone'] = 'Numéro de téléphone invalide';
      erreursTrouvees = true;
    }

    if (erreursTrouvees) {
      this.erreur = "Veuillez corriger les erreurs dans le formulaire";
      return false;
    }
    return true;
  }

  etapeSuivante() {
    if (this.validerEtape1()) {
      this.etapeCourante = 2;
    }
  }

  etapePrecedente() {
    this.erreur = '';
    this.erreurChamp = {};
    this.etapeCourante = 1;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validation du type de fichier
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        this.erreur = 'Seuls les fichiers JPEG, PNG et PDF sont autorisés';
        this.selectedFile = null;
        return;
      }

      // Validation de la taille (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        this.erreur = 'La taille du fichier ne doit pas dépasser 5MB';
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      this.erreur = '';
    }
  }

  uploadDocument() {
    if (!this.selectedFile || !this.requestId) {
      return;
    }

    this.uploadEnCours = true;
    const formData = new FormData();
    formData.append('document', this.selectedFile);
    formData.append('document_type', this.documentType);

    this.http.post<any>(`${environment.apiUrl}/hospitals/request/${this.requestId}/document`, formData).subscribe({
      next: () => {
        this.uploadEnCours = false;
        this.selectedFile = null;
      },
      error: (err) => {
        this.uploadEnCours = false;
        this.erreur = err.error?.error || "Erreur lors de l'upload du document";
      }
    });
  }

  envoyerDemande() {
    this.erreur = '';
    this.erreurChamp = {};

    const champsRequis = [
      { nom: 'hospitalName', valeur: this.hospitalName.trim(), libelle: "Nom de l'établissement" },
      { nom: 'numeroAgrement', valeur: this.numeroAgrement.trim(), libelle: "Numéro d'agrément / licence" },
      { nom: 'contactName', valeur: this.contactName.trim(), libelle: 'Nom du contact' },
      { nom: 'contactEmail', valeur: this.contactEmail.trim(), libelle: 'Email du contact' }
    ];

    let erreursTrouvees = false;

    for (const champ of champsRequis) {
      if (!champ.valeur) {
        this.erreurChamp[champ.nom] = `${champ.libelle} est requis`;
        erreursTrouvees = true;
      }
    }

    if (!this.accepteConditions) {
      this.erreurChamp['conditions'] = 'Vous devez accepter les conditions';
      erreursTrouvees = true;
    }

    if (!erreursTrouvees && !this.validerEmail(this.contactEmail)) {
      this.erreurChamp['contactEmail'] = 'Email invalide';
      erreursTrouvees = true;
    }

    if (!erreursTrouvees && !this.validerTelephone(this.contactPhone)) {
      this.erreurChamp['contactPhone'] = 'Numéro de téléphone invalide';
      erreursTrouvees = true;
    }

    if (!erreursTrouvees && this.messageLength > this.maxMessageLength) {
      this.erreurChamp['message'] = `Message trop long (max ${this.maxMessageLength} caractères)`;
      erreursTrouvees = true;
    }

    if (erreursTrouvees) {
      this.erreur = "Veuillez corriger les erreurs dans le formulaire";
      return;
    }

    this.envoiEnCours = true;
    this.http.post<any>(`${environment.apiUrl}/hospitals/request`, {
      hospital_name: this.hospitalName,
      contact_name: this.contactName,
      contact_email: this.contactEmail.toLowerCase(),
      contact_phone: this.contactPhone || undefined,
      address: this.address || undefined,
      numero_agrement: this.numeroAgrement || undefined,
      message: this.message || undefined
    }).subscribe({
      next: (res) => {
        this.envoiEnCours = false;
        this.requestId = res.request_id;
        
        // Si un fichier est sélectionné, l'uploader automatiquement
        if (this.selectedFile) {
          this.uploadDocument();
        } else {
          this.envoye = true;
        }
      },
      error: (err) => {
        this.envoiEnCours = false;
        this.erreur = err.error?.error || "Erreur lors de l'envoi de la demande";
      }
    });
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}