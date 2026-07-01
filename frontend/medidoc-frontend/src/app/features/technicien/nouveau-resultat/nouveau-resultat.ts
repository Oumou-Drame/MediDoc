import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UploadService } from '../../../core/services/upload-service';
import { CanalOption, UploadResponse } from '../models/upload';


@Component({
  selector: 'app-nouveau-resultat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouveau-resultat.html',
  styleUrl: './nouveau-resultat.css',
})
export class NouveauResultat implements OnInit {
  private uploadService = inject(UploadService);
  private router = inject(Router);

  canaux: CanalOption[] = [];
  patientName = '';
  patientPhone = '';
  patientEmail = '';
  channelChoisi = '';
  fichier: File | null = null;
  nomFichier = '';

  envoiEnCours = false;
  erreur = '';
  resultat: UploadResponse | null = null;

  ngOnInit(): void {
    this.uploadService.getFormData().subscribe({
      next: (res) => { this.canaux = res.channels; },
      error: () => { this.erreur = "Impossible de charger les options d'envoi"; }
    });
  }
  onFichierSelectionne(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const f = input.files[0];
      if (f.type !== 'application/pdf') {
        this.erreur = 'Seuls les fichiers PDF sont acceptés';
        this.fichier = null;
        this.nomFichier = '';
        return;
      }
      this.fichier = f;
      this.nomFichier = f.name;
      this.erreur = '';
    }
  }
  envoyer() {
    this.erreur = '';
    if (!this.patientName || !this.patientPhone || !this.patientEmail) {
      this.erreur = 'Nom, téléphone et email du patient sont obligatoires';
      return;
    }
    if (!this.fichier) {
      this.erreur = 'Veuillez sélectionner un fichier PDF';
      return;
    }
    if (!this.channelChoisi) {
      this.erreur = "Veuillez choisir un mode d'envoi";
      return;
    }
    const donnees = new FormData();
    donnees.append('patient_name', this.patientName);
    donnees.append('patient_phone', this.patientPhone);
    donnees.append('patient_email', this.patientEmail);
    donnees.append('channel', this.channelChoisi);
    donnees.append('pdf', this.fichier);

    this.envoiEnCours = true;
    this.uploadService.envoyerResultat(donnees).subscribe({
      next: (res) => { this.envoiEnCours = false; this.resultat = res.data; },
      error: (err) => { this.envoiEnCours = false; this.erreur = err.error?.error || "Erreur lors de l'envoi"; }
    });
  }
  nouvelEnvoi() {
    this.resultat = null;
    this.patientName = ''; this.patientPhone = ''; this.patientEmail = '';
    this.channelChoisi = ''; this.fichier = null; this.nomFichier = '';
  }
}
