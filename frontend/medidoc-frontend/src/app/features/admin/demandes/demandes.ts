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
  document_status: 'not_required' | 'pending' | 'verified' | 'rejected';
  created_at: string;
}

interface HospitalDocument {
  id: number;
  document_type: string;
  file_name: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  upload_date: string;
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
  selectedRequest: HospitalRequest | null = null;
  documents: HospitalDocument[] = [];
  documentsChargement = false;
  verificationEnCours: number | null = null;

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

  voirDocuments(r: HospitalRequest) {
    this.selectedRequest = r;
    this.documentsChargement = true;
    this.documents = [];
    
    this.platformService.getRequestDocuments(r.id).subscribe({
      next: (res: any) => {
        this.documents = res.data;
        this.documentsChargement = false;
      },
      error: () => {
        this.documentsChargement = false;
        alert('Erreur lors du chargement des documents');
      }
    });
  }

  fermerDocuments() {
    this.selectedRequest = null;
    this.documents = [];
  }

  verifierDocument(docId: number, status: 'verified' | 'rejected') {
    const reason = status === 'rejected' ? prompt('Motif du rejet (optionnel) :') || undefined : undefined;
    this.verificationEnCours = docId;
    
    this.platformService.verifyDocument(this.selectedRequest!.id, docId, status, reason).subscribe({
      next: () => {
        this.verificationEnCours = null;
        this.voirDocuments(this.selectedRequest!);
      },
      error: (err: any) => {
        this.verificationEnCours = null;
        alert(err.error?.error || 'Erreur lors de la vérification');
      }
    });
  }

  telechargerDocument(docId: number) {
    window.open(`http://localhost:5000/api/hospitals/request/${this.selectedRequest!.id}/documents/${docId}`, '_blank');
  }

  getDocumentStatusBadge(status: string): string {
    switch(status) {
      case 'verified': return '✓ Vérifié';
      case 'rejected': return '✕ Rejeté';
      default: return '⏳ En attente';
    }
  }

  getDocumentStatusClass(status: string): string {
    switch(status) {
      case 'verified': return 'status-verified';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }
}
