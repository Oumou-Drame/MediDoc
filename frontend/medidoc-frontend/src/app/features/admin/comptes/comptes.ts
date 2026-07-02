import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);

  techniciens: Technicien[] = [];
  afficherFormulaire = false;
  modeEdition = false;
  idEnCours: number | null = null;

  formData = { email: '', password: '', first_name: '', last_name: '', date_naissance: '', phone: '' };

  ngOnInit(): void {
    this.chargerTechniciens();

    // Permet d'arriver directement sur le formulaire depuis le bouton "+ Nouveau technicien"
    // du dashboard, sans avoir à recliquer une fois sur la page (ex: /lab-manager/comptes?nouveau=1).
    if (this.route.snapshot.queryParamMap.get('nouveau')) {
      this.ouvrirAjout();
    }
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
    this.formData = { email: '', password: '', first_name: '', last_name: '', date_naissance: '', phone: '' };
    this.afficherFormulaire = true;
  }

  ouvrirEdition(tech: Technicien) {
    this.modeEdition = true;
    this.idEnCours = tech.id;
    this.formData = {
      email: tech.email,
      password: '',
      first_name: tech.first_name || '',
      last_name: tech.last_name || '',
      date_naissance: tech.date_naissance ? tech.date_naissance.substring(0, 10) : '',
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
        first_name: this.formData.first_name,
        last_name: this.formData.last_name,
        date_naissance: this.formData.date_naissance,
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