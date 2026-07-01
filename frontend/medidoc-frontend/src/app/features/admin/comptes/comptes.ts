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
  matriculeGenere = '';

  formData = { email: '', full_name: '', phone: '', role: 'technicien', date_naissance: '' };
  enregistrement = false;
  afficherSceau = false;

  ngOnInit(): void {
    this.chargerTechniciens();
  }

  chargerTechniciens() {
    this.adminService.getUsers().subscribe({
      next: (res) => { this.techniciens = res.data; },
      error: (err) => console.error('Erreur chargement:', err)
    });
  }

  ouvrirAjout() {
    this.modeEdition = false;
    this.idEnCours = null;
    this.matriculeGenere = '';
    this.formData = { email: '', full_name: '', phone: '', role: 'technicien', date_naissance: '' };
    this.afficherFormulaire = true;
  }

  ouvrirEdition(tech: Technicien) {
    this.modeEdition = true;
    this.idEnCours = tech.id;
    this.matriculeGenere = tech.matricule || '';
    this.formData = {
      email: tech.email,
      full_name: tech.full_name,
      phone: tech.phone || '',
      role: tech.role,
      date_naissance: tech.date_naissance ? tech.date_naissance.substring(0, 10) : ''
    };
    this.afficherFormulaire = true;
  }

  annuler() {
    this.afficherFormulaire = false;
  }

  valider() {
    if (this.modeEdition && this.idEnCours) {
      this.enregistrement = true;
      this.adminService.updateUser(this.idEnCours, {
        full_name: this.formData.full_name,
        email: this.formData.email,
        phone: this.formData.phone,
        role: this.formData.role,
        date_naissance: this.formData.date_naissance || undefined
      }).subscribe({
        next: () => { 
          this.afficherFormulaire = false; 
          this.enregistrement = false;
          this.chargerTechniciens(); 
        },
        error: (err) => {
          this.enregistrement = false;
          alert(err.error?.error || 'Erreur lors de la modification');
        }
      });
    } else {
      this.enregistrement = true;
      this.adminService.createUser({
        email: this.formData.email,
        full_name: this.formData.full_name,
        phone: this.formData.phone,
        role: this.formData.role,
        date_naissance: this.formData.date_naissance || undefined
      }).subscribe({
        next: (res) => {
          this.enregistrement = false;
          this.matriculeGenere = res.data?.matricule || '';
          this.chargerTechniciens();
          if (res.data?.matricule) {
            this.afficherSceau = true;
          }
        },
        error: (err) => {
          this.enregistrement = false;
          alert(err.error?.error || 'Erreur lors de la création');
        }
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
      t.email.toLowerCase().includes(terme) ||
      (t.matricule && t.matricule.toLowerCase().includes(terme))
    );
  }

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      'technicien': 'Technicien',
      'responsable_labo': 'Responsable de laboratoire'
    };
    return labels[role] || role;
  }

  fermerSceau() {
    this.afficherSceau = false;
    this.afficherFormulaire = false;
    this.matriculeGenere = '';
  }

  copierMatricule() {
    if (this.matriculeGenere) {
      navigator.clipboard.writeText(this.matriculeGenere).then(() => {
        // Could add a toast notification here
      }).catch(err => {
        console.error('Erreur lors de la copie:', err);
      });
    }
  }
}