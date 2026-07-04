import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryService} from '../../../core/services/history-service';
import { ResultatMedical } from '../models/history';
import { Pagination } from '../models/history';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './historique.html',
  styleUrl: './historique.css',
})
export class Historique implements OnInit {
  private historyService = inject(HistoryService);

  resultats: ResultatMedical[] = [];
  pagination: Pagination | null = null;

  recherche = '';
  statutFiltre = '';
  pageActuelle = 1;
  limiteParPage = 20;
  statuts = [
    { valeur: '', libelle: 'Tous les statuts' },
    { valeur: 'pending', libelle: 'En attente' },
    { valeur: 'sent', libelle: 'Envoyé' },
    { valeur: 'delivered', libelle: 'Délivré' },
    { valeur: 'accessed', libelle: 'Consulté' },
    { valeur: 'expired', libelle: 'Expiré' },
    { valeur: 'locked', libelle: 'Verrouillé' },
    { valeur: 'cancelled', libelle: 'Annulé' },
  ];
  annulationEnCours: number | null = null;

  private timeoutRecherche: any;
  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.historyService.getHistory({
      status: this.statutFiltre || undefined,
      search: this.recherche || undefined,
      page: this.pageActuelle,
      limit: this.limiteParPage
    }).subscribe({
      next: (res) => {
        this.resultats = res.data.results;
        this.pagination = res.data.pagination;
      },
      error: (err) => console.error('Erreur chargement historique:', err)
    });
  }
  onRechercheChange() {
    clearTimeout(this.timeoutRecherche);
    this.timeoutRecherche = setTimeout(() => {
      this.pageActuelle = 1;
      this.charger();
    }, 400);
  }
  onStatutChange() {
    this.pageActuelle = 1;
    this.charger();
  }

  pagePrecedente() {
    if (this.pageActuelle > 1) {
      this.pageActuelle--;
      this.charger();
    }
  }

  pageSuivante() {
    if (this.pagination && this.pageActuelle < this.pagination.pages) {
      this.pageActuelle++;
      this.charger();
    }
  }
    libelleStatut(statut: string): string {
      return this.statuts.find(s => s.valeur === statut)?.libelle || statut;
    }

    peutAnnuler(r: ResultatMedical): boolean {
      return r.status !== 'cancelled' && r.status !== 'expired';
    }

    annuler(r: ResultatMedical) {
      if (!confirm(`Annuler l'envoi pour ${r.patient_name} ? Le lien envoyé au patient deviendra invalide.`)) return;
      this.annulationEnCours = r.id;
      this.historyService.cancel(r.id).subscribe({
        next: () => { this.annulationEnCours = null; this.charger(); },
        error: (err) => {
          this.annulationEnCours = null;
          alert(err.error?.error || "Erreur lors de l'annulation");
        }
      });
    }
  }

