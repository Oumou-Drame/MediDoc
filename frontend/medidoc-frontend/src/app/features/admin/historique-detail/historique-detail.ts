import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HistoryService } from '../../../core/services/history-service';
import { ResultatMedical } from '../models/history';

@Component({
  selector: 'app-historique-detail',
  standalone: true,
  imports: [CommonModule],
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

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.historyService.getDetail(id).subscribe({
      next: (res) => { this.resultat = res.data; this.chargement = false; },
      error: () => { this.erreur = 'Résultat introuvable'; this.chargement = false; }
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
    this.router.navigateByUrl('/admin/historique');
  }
}