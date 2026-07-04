import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HistoryService } from '../../../core/services/history-service';
import { ResultatMedical } from '../models/history';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-historique-detail',
  standalone: true,
  imports: [CommonModule, ConfirmDialog],
  templateUrl: './historique-detail.html',
  styleUrl: './historique-detail.css',
})
export class HistoriqueDetail implements OnInit {
  private historyService = inject(HistoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  resultat: ResultatMedical | null = null;
  chargement = true;
  erreur = '';
  lienCopie = false;

  // Lien d'accès patient reconstruit côté client (même origine que /access/:token de cette app),
  // utile pour retester ou renvoyer manuellement sans dépendre d'un vrai envoi SMS/WhatsApp/Email.
  get lienAcces(): string {
    if (!this.resultat?.access_token) return '';
    return `${window.location.origin}/access/${this.resultat.access_token}`;
  }

  copierLien() {
    if (!this.lienAcces) return;
    navigator.clipboard.writeText(this.lienAcces).then(() => {
      this.lienCopie = true;
      setTimeout(() => { this.lienCopie = false; }, 2000);
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.historyService.getDetail(id).subscribe({
      next: (res) => { this.resultat = res.data; this.chargement = false; },
      error: () => { this.erreur = 'Résultat introuvable'; this.chargement = false; }
    });
  }

  annulationEnCours = false;
  confirmationAnnulationVisible = false;
  erreurAnnulation = '';

  peutAnnuler(): boolean {
    return !!this.resultat && this.resultat.status !== 'cancelled' && this.resultat.status !== 'expired';
  }

  demanderAnnulation() {
    this.erreurAnnulation = '';
    this.confirmationAnnulationVisible = true;
  }

  fermerConfirmation() {
    if (this.annulationEnCours) return;
    this.confirmationAnnulationVisible = false;
  }

  confirmerAnnulation() {
    if (!this.resultat) return;
    this.annulationEnCours = true;
    this.historyService.cancel(this.resultat.id).subscribe({
      next: () => {
        this.annulationEnCours = false;
        this.confirmationAnnulationVisible = false;
        if (this.resultat) { this.resultat.status = 'cancelled'; }
      },
      error: (err) => {
        this.annulationEnCours = false;
        this.confirmationAnnulationVisible = false;
        this.erreurAnnulation = err.error?.error || "Erreur lors de l'annulation";
      }
    });
  }

  debloquer() {
    if (!this.resultat) return;
    this.historyService.unlock(this.resultat.id).subscribe({
      next: () => {
        if (this.resultat) { this.resultat.is_locked = 0; this.resultat.attempt_count = 0; }
      },
      error: (err) => alert(err.error?.error || 'Erreur lors du déblocage')
    });
  }

  retour() {
    this.router.navigateByUrl('/lab-manager/historique');
  }
}