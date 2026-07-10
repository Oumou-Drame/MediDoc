import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';
import { ResponsableLabo } from '../models/responsable-labo';

@Component({
  selector: 'app-responsables-labo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './responsables-labo.html',
  styleUrl: './responsables-labo.css',
})
export class ResponsablesLabo implements OnInit {
  private adminService = inject(AdminService);

  responsables: ResponsableLabo[] = [];
  rechercheLocale = '';
  chargement = true;
  erreur = '';

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.adminService.getLabManagers().subscribe({
      next: (res) => { this.responsables = res.data; this.chargement = false; },
      error: (err) => {
        this.erreur = err.error?.error || 'Erreur lors du chargement';
        this.chargement = false;
      }
    });
  }

  toggleStatut(resp: ResponsableLabo) {
    this.adminService.toggleLabManager(resp.id).subscribe({
      next: () => this.charger(),
      error: (err) => alert(err.error?.error || 'Erreur')
    });
  }

  get responsablesFiltres(): ResponsableLabo[] {
    if (!this.rechercheLocale.trim()) return this.responsables;
    const terme = this.rechercheLocale.toLowerCase();
    return this.responsables.filter(r =>
      r.full_name.toLowerCase().includes(terme) ||
      r.email.toLowerCase().includes(terme) ||
      r.hospital_name.toLowerCase().includes(terme)
    );
  }
}
