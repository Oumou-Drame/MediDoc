import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HistoryService } from '../../../core/services/history-service';
import { AuthService } from '../../../core/services/auth-service';
import { ResultatMedical, Pagination } from '../../admin/models/history'

@Component({
  selector: 'app-historique-technicien',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
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
  ];
  ngOnInit(): void { this.charger(); }
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
  seDeconnecter() {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login')
    });
  }
}
