import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HistoryService } from '../../../core/services/history-service';
import { AuthService } from '../../../core/services/auth-service';
import { ResultatMedical, Pagination } from '../../admin/models/history'
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-historique-technicien',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialog],
  templateUrl: './historique-technicien.html',
  styleUrl: './historique-technicien.css',
})
export class HistoriqueTechnicien implements OnInit {
  private historyService = inject(HistoryService);
  private authService = inject(AuthService);
  private router = inject(Router);
  resultats: ResultatMedical[] = [];
  pagination: Pagination | null = null;
  recherche = '';
  statutFiltre = '';
  pageActuelle = 1;
  limiteParPage = 20;
  private timeoutRecherche: any;

  statuts = [
    { valeur: '', libelle: 'Tous les statuts' },
    { valeur: 'pending', libelle: 'En attente' },
    { valeur: 'sent', libelle: 'Envoyé' },
    { valeur: 'accessed', libelle: 'Consulté' },
    { valeur: 'expired', libelle: 'Expiré' },
    { valeur: 'locked', libelle: 'Verrouillé' },
    { valeur: 'cancelled', libelle: 'Annulé' },
  ];
  annulationEnCours: number | null = null;

  stats = { total: 0, en_attente: 0, consultes: 0, annules: 0 };

  private readonly libellesCanaux: Record<string, string> = {
    email_whatsapp: 'WhatsApp + Email',
    email_sms: 'Email + SMS',
  };

  ngOnInit(): void {
    this.charger();
    this.chargerStats();
  }

  charger() {
    this.historyService.getHistory({
      status: this.statutFiltre || undefined,
      search: this.recherche || undefined,
      page: this.pageActuelle,
      limit: this.limiteParPage
    }).subscribe({
      next: (res) => { this.resultats = res.data.results; this.pagination = res.data.pagination; },
      error: (err) => console.error('Erreur chargement historique:', err)
    });
  }

  chargerStats() {
    this.historyService.getStats().subscribe({
      next: (res) => { this.stats = res.data; },
      error: (err) => console.error('Erreur chargement des statistiques:', err)
    });
  }

  libelleCanal(channel: string): string {
    return this.libellesCanaux[channel] || channel;
  }
  onRechercheChange() {
    clearTimeout(this.timeoutRecherche);
    this.timeoutRecherche = setTimeout(() => { this.pageActuelle = 1; this.charger(); }, 400);
  }

  onStatutChange() { this.pageActuelle = 1; this.charger(); }
  pagePrecedente() { if (this.pageActuelle > 1) { this.pageActuelle--; this.charger(); } }
  pageSuivante() { if (this.pagination && this.pageActuelle < this.pagination.pages) { this.pageActuelle++; this.charger(); } }

  libelleStatut(statut: string): string {
    return this.statuts.find(s => s.valeur === statut)?.libelle || statut;
  }

  peutAnnuler(r: ResultatMedical): boolean {
    if (r.status === 'cancelled' || r.status === 'expired') return false;
    return new Date(r.expires_at).getTime() > Date.now();
  }

  resultatAAnnuler: ResultatMedical | null = null;
  erreurAnnulation = '';

  demanderAnnulation(r: ResultatMedical) {
    this.erreurAnnulation = '';
    this.resultatAAnnuler = r;
  }

  fermerConfirmation() {
    if (this.annulationEnCours) return;
    this.resultatAAnnuler = null;
  }

  confirmerAnnulation() {
    const r = this.resultatAAnnuler;
    if (!r) return;
    this.annulationEnCours = r.id;
    this.historyService.cancel(r.id).subscribe({
      next: () => { this.annulationEnCours = null; this.resultatAAnnuler = null; this.charger(); this.chargerStats(); },
      error: (err) => {
        this.annulationEnCours = null;
        this.resultatAAnnuler = null;
        this.erreurAnnulation = err.error?.error || "Erreur lors de l'annulation";
      }
    });
  }
  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }
}
