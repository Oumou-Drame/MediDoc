import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformService } from '../../../core/services/platform-service';

interface HospitalRequest {
  id: number;
  hospital_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demandes.html',
  styleUrl: './demandes.css',
})
export class Demandes implements OnInit {
  private platformService = inject(PlatformService);

  chargement = true;
  traitementEnCours: number | null = null;
  requests: HospitalRequest[] = [];

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.platformService.getRequests('pending').subscribe({
      next: (res) => { this.requests = res.data; this.chargement = false; },
      error: () => { this.chargement = false; }
    });
  }

  valider(r: HospitalRequest) {
    if (!confirm(`Valider la demande de "${r.hospital_name}" ? Un hôpital et un compte responsable de labo seront créés automatiquement.`)) return;
    this.traitementEnCours = r.id;
    this.platformService.approveRequest(r.id).subscribe({
      next: () => { this.traitementEnCours = null; this.charger(); },
      error: (err) => { this.traitementEnCours = null; alert(err.error?.error || 'Erreur lors de la validation'); }
    });
  }

  refuser(r: HospitalRequest) {
    const reason = prompt(`Motif du refus pour "${r.hospital_name}" (optionnel) :`) || undefined;
    this.traitementEnCours = r.id;
    this.platformService.rejectRequest(r.id, reason).subscribe({
      next: () => { this.traitementEnCours = null; this.charger(); },
      error: (err) => { this.traitementEnCours = null; alert(err.error?.error || 'Erreur lors du refus'); }
    });
  }
}
