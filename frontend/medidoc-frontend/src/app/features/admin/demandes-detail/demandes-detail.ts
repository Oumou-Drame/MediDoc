import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PlatformService } from '../../../core/services/platform-service';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { environment } from '../../../../environments/environment';

interface HospitalRequest {
  id: number;
  hospital_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  numero_agrement: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  document_status: 'not_required' | 'pending' | 'verified' | 'rejected';
  created_at: string;
}

interface HospitalDocument {
  id: number;
  document_type: string;
  file_name: string;
  mime_type: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  upload_date: string;
}

@Component({
  selector: 'app-demandes-detail',
  standalone: true,
  imports: [CommonModule, ConfirmDialog],
  templateUrl: './demandes-detail.html',
  styleUrl: './demandes-detail.css',
})
export class DemandesDetail implements OnInit {
  private platformService = inject(PlatformService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiBase = `${environment.apiUrl}/hospitals`;

  demande: HospitalRequest | null = null;
  chargement = true;
  erreur = '';

  documents: HospitalDocument[] = [];
  documentsChargement = false;
  verificationEnCours: number | null = null;

  traitementEnCours = false;

  // Modals de confirmation (app-confirm-dialog, réutilisé pour Valider et Refuser)
  confirmationValidationVisible = false;
  confirmationRefusVisible = false;
  motifRefus = '';
  erreurAction = '';

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.charger(id);
  }

  charger(id: number) {
    this.chargement = true;
    this.platformService.getRequest(id).subscribe({
      next: (res) => {
        this.demande = res.data;
        this.chargement = false;
        if (this.demande && this.demande.document_status !== 'not_required') {
          this.chargerDocuments(this.demande.id);
        }
      },
      error: () => { this.erreur = 'Demande introuvable'; this.chargement = false; }
    });
  }

  chargerDocuments(requestId: number) {
    this.documentsChargement = true;
    this.platformService.getRequestDocuments(requestId).subscribe({
      next: (res: any) => { this.documents = res.data; this.documentsChargement = false; },
      error: () => { this.documentsChargement = false; }
    });
  }

  documentViewUrl(doc: HospitalDocument): string {
    return `${this.apiBase}/request/${this.demande!.id}/documents/${doc.id}/view`;
  }

  documentViewUrlSafe(doc: HospitalDocument): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.documentViewUrl(doc));
  }

  estImage(doc: HospitalDocument): boolean {
    return !!doc.mime_type?.startsWith('image/');
  }

  estPdf(doc: HospitalDocument): boolean {
    return doc.mime_type === 'application/pdf';
  }

  telechargerDocument(docId: number) {
    window.open(`${this.apiBase}/request/${this.demande!.id}/documents/${docId}`, '_blank');
  }

  verifierDocument(docId: number, status: 'verified' | 'rejected') {
    this.verificationEnCours = docId;
    this.platformService.verifyDocument(this.demande!.id, docId, status).subscribe({
      next: () => {
        this.verificationEnCours = null;
        this.chargerDocuments(this.demande!.id);
        // Recharge la demande pour refléter le document_status mis à jour
        this.platformService.getRequest(this.demande!.id).subscribe({
          next: (res) => { this.demande = res.data; }
        });
      },
      error: (err: any) => {
        this.verificationEnCours = null;
        alert(err.error?.error || 'Erreur lors de la vérification');
      }
    });
  }

  getDocumentStatusBadge(status: string): string {
    switch (status) {
      case 'verified': return '✓ Vérifié';
      case 'rejected': return '✕ Rejeté';
      default: return '⏳ En attente';
    }
  }

  getDocumentStatusClass(status: string): string {
    switch (status) {
      case 'verified': return 'status-verified';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }

  // --- Valider ---
  demanderValidation() {
    this.erreurAction = '';
    this.confirmationValidationVisible = true;
  }

  fermerConfirmationValidation() {
    if (this.traitementEnCours) return;
    this.confirmationValidationVisible = false;
  }

  confirmerValidation() {
    if (!this.demande) return;
    this.traitementEnCours = true;
    this.platformService.approveRequest(this.demande.id).subscribe({
      next: () => {
        this.traitementEnCours = false;
        this.confirmationValidationVisible = false;
        this.retour();
      },
      error: (err) => {
        this.traitementEnCours = false;
        this.confirmationValidationVisible = false;
        this.erreurAction = err.error?.error || 'Erreur lors de la validation';
      }
    });
  }

  // --- Refuser ---
  demanderRefus() {
    this.erreurAction = '';
    this.motifRefus = '';
    this.confirmationRefusVisible = true;
  }

  fermerConfirmationRefus() {
    if (this.traitementEnCours) return;
    this.confirmationRefusVisible = false;
  }

  confirmerRefus() {
    if (!this.demande) return;
    this.traitementEnCours = true;
    this.platformService.rejectRequest(this.demande.id, this.motifRefus || undefined).subscribe({
      next: () => {
        this.traitementEnCours = false;
        this.confirmationRefusVisible = false;
        this.retour();
      },
      error: (err) => {
        this.traitementEnCours = false;
        this.confirmationRefusVisible = false;
        this.erreurAction = err.error?.error || 'Erreur lors du refus';
      }
    });
  }

  retour() {
    this.router.navigateByUrl('/admin/demandes');
  }
}
