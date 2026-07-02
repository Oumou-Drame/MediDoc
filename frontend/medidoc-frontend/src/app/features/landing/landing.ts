import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RegistrationService } from '../../core/services/registration-service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  private registrationService = inject(RegistrationService);

  hospitalName = '';
  contactName = '';
  contactEmail = '';
  contactPhone = '';
  message = '';

  envoiEnCours = false;
  envoye = false;
  erreur = '';

  envoyerDemande() {
    this.erreur = '';
    if (!this.hospitalName.trim() || !this.contactName.trim() || !this.contactEmail.trim()) {
      this.erreur = "Le nom de l'établissement, le contact et l'email sont obligatoires";
      return;
    }

    this.envoiEnCours = true;
    this.registrationService.submitRequest({
      hospital_name: this.hospitalName,
      contact_name: this.contactName,
      contact_email: this.contactEmail,
      contact_phone: this.contactPhone || undefined,
      message: this.message || undefined
    }).subscribe({
      next: () => { this.envoiEnCours = false; this.envoye = true; },
      error: (err) => { this.envoiEnCours = false; this.erreur = err.error?.error || "Erreur lors de l'envoi de la demande"; }
    });
  }
}
