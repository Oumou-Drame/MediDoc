import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';
import { JournalEntry, Auteur, ActivitePagination } from '../models/activite';

@Component({
  selector: 'app-activite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activite.html',
  styleUrl: './activite.css',
})
export class Activite implements OnInit {
  private adminService = inject(AdminService);

  logs: JournalEntry[] = [];
  auteurs: Auteur[] = [];
  pagination: ActivitePagination | null = null;

  recherche = '';
  actionFiltre = '';
  auteurFiltre = '';
  dateDebut = '';
  dateFin = '';
  pageActuelle = 1;
  limiteParPage = 20;
  private timeoutRecherche: any;

  actions = [
    { valeur: '', libelle: 'Toutes les actions' },
    { valeur: 'upload', libelle: 'Envoi de résultat' },
    { valeur: 'upload_failed', libelle: "Échec d'envoi" },
    { valeur: 'cancel_result', libelle: "Annulation d'envoi" },
    { valeur: 'create_technician', libelle: 'Création de technicien' },
    { valeur: 'update_technician', libelle: 'Modification de technicien' },
    { valeur: 'toggle_technician', libelle: 'Activation/suspension de technicien' },
    { valeur: 'delete_technician', libelle: 'Suppression de technicien' },
  ];

  ngOnInit(): void {
    this.charger();
    this.adminService.getActiviteAuteurs().subscribe({
      next: (res) => { this.auteurs = res.data; },
      error: (err) => console.error('Erreur chargement des auteurs:', err)
    });
  }

  charger() {
    this.adminService.getActivite({
      action: this.actionFiltre || undefined,
      technicien: this.auteurFiltre ? Number(this.auteurFiltre) : undefined,
      search: this.recherche || undefined,
      date_debut: this.dateDebut || undefined,
      date_fin: this.dateFin || undefined,
      page: this.pageActuelle,
      limit: this.limiteParPage
    }).subscribe({
      next: (res) => { this.logs = res.data.logs; this.pagination = res.data.pagination; },
      error: (err) => console.error('Erreur chargement du journal:', err)
    });
  }

  onRechercheChange() {
    clearTimeout(this.timeoutRecherche);
    this.timeoutRecherche = setTimeout(() => { this.pageActuelle = 1; this.charger(); }, 400);
  }

  onFiltreChange() {
    this.pageActuelle = 1;
    this.charger();
  }

  reinitialiserFiltres() {
    this.recherche = '';
    this.actionFiltre = '';
    this.auteurFiltre = '';
    this.dateDebut = '';
    this.dateFin = '';
    this.pageActuelle = 1;
    this.charger();
  }

  pagePrecedente() { if (this.pageActuelle > 1) { this.pageActuelle--; this.charger(); } }
  pageSuivante() { if (this.pagination && this.pageActuelle < this.pagination.pages) { this.pageActuelle++; this.charger(); } }

  libelleAction(action: string): string {
    return this.actions.find(a => a.valeur === action)?.libelle || action;
  }
}
