import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PatientAccessService } from '../../../core/services/patient-access-service';
import { PatientInfo, VerifyResponse } from '../models/patient-access';

@Component({
  selector: 'app-access-patient',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './access-patient.html',
  styleUrl: './access-patient.css',
})
export class AccessPatient implements OnInit {
  private patientService = inject(PatientAccessService);
  private route = inject(ActivatedRoute);

  token = '';
  chargement = true;
  erreurChargement = '';
  info: PatientInfo | null = null;

  code = '';
  erreurCode = '';
  verificationEnCours = false;
  resultat: VerifyResponse | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.patientService.getInfo(this.token).subscribe({
      next: (res) => { this.info = res.data; this.chargement = false; },
      error: (err) => { this.erreurChargement = err.error?.error || 'Lien invalide'; this.chargement = false; }
    });
  }

  valider() {
    this.erreurCode = '';
    if (!this.code || this.code.length !== 6) {
      this.erreurCode = 'Veuillez saisir un code à 6 chiffres';
      return;
    }
    this.verificationEnCours = true;
    this.patientService.verify(this.token, this.code).subscribe({
      next: (res) => { this.verificationEnCours = false; this.resultat = res.data; },
      error: (err) => {
        this.verificationEnCours = false;
        this.erreurCode = err.error?.error || 'Erreur de vérification';
        if (err.error?.locked && this.info) { this.info.is_locked = 1; }
      }
    });
  }

  get urlTelechargement(): string {
    if (!this.resultat) return '';
    return `http://localhost:3000${this.resultat.download_url}`;
  }
}