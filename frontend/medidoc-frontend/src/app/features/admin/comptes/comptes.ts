import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin-service';
import { Technicien } from '../models/info-techniciens';

@Component({
  selector: 'app-comptes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comptes.html',
  styleUrl: './comptes.css',
})
export class Comptes implements OnInit {
  private adminService = inject(AdminService);

  techniciens: Technicien[] = [];
  afficherFormulaire = false;
  modeEdition = false;
  idEnCours: number | null = null;

  formData = { username: '', email: '', password: '', full_name: '', phone: '' };

  ngOnInit(): void {
    this.chargerTechniciens();
  }

  chargerTechniciens() {
    this.adminService.getUsers().subscribe({
      next: (res) => { this.techniciens = res.data; },
      error: (err) => console.error('Erreur chargement techniciens:', err)
    });
  }

  ouvrirAjout() {
    this.modeEdition = false;
    this.idEnCours = null;
    this.formData = { username: '', email: '', password: '', full_name: '', phone: '' };
    this.afficherFormulaire = true;
  }

  ouvrirEdition(tech: Technicien) {
    this.modeEdition = true;
    this.idEnCours = tech.id;
    this.formData = {
      username: tech.username,
      email: tech.email,
      password: '',
      full_name: tech.full_name,
      phone: tech.phone || ''
    };
    this.afficherFormulaire = true;
  }

  annuler() {
    this.afficherFormulaire = false;
  }

  valider() {
    if (this.modeEdition && this.idEnCours) {
      this.adminService.updateUser(this.idEnCours, {
        full_name: this.formData.full_name,
        email: this.formData.email,
        phone: this.formData.phone
      }).subscribe({
        next: () => { this.afficherFormulaire = false; this.chargerTechniciens(); },
        error: (err) => alert(err.error?.error || 'Erreur lors de la modification')
      });
    } else {
      this.adminService.createUser(this.formData).subscribe({
        next: () => { this.afficherFormulaire = false; this.chargerTechniciens(); },
        error: (err) => alert(err.error?.error || 'Erreur lors de la création')
      });
    }
  }

  toggleStatut(tech: Technicien) {
    this.adminService.toggleUser(tech.id).subscribe({
      next: () => this.chargerTechniciens(),
      error: (err) => alert(err.error?.error || 'Erreur')
    });
  }
  supprimer(tech: Technicien) {
    if (!confirm(`Supprimer le compte de ${tech.full_name} ?`)) return;
    this.adminService.deleteUser(tech.id).subscribe({
      next: () => this.chargerTechniciens(),
      error: (err) => alert(err.error?.error || 'Erreur')
    });
  }
  rechercheLocale = '';

  get techniciensFiltres(): Technicien[] {
    if (!this.rechercheLocale.trim()) return this.techniciens;
    const terme = this.rechercheLocale.toLowerCase();
    return this.techniciens.filter(t =>
      t.full_name.toLowerCase().includes(terme) ||
      t.email.toLowerCase().includes(terme)
    );
  }
}