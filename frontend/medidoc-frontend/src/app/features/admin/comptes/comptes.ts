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
  tempPassword = '';

<<<<<<< HEAD
  formData = { email: '', full_name: '', phone: '', role: 'technicien' };
  enregistrement = false;
  afficherSceau = false;
=======
  formData = { email: '', password: '', first_name: '', last_name: '', date_naissance: '', phone: '' };
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

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
      error: (err) => console.error('Erreur chargement:', err)
    });
  }

  ouvrirAjout() {
    this.modeEdition = false;
    this.idEnCours = null;
<<<<<<< HEAD
    this.tempPassword = '';
    this.formData = { email: '', full_name: '', phone: '', role: 'technicien' };
=======
    this.formData = { email: '', password: '', first_name: '', last_name: '', date_naissance: '', phone: '' };
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
    this.afficherFormulaire = true;
  }

  ouvrirEdition(tech: Technicien) {
    this.modeEdition = true;
    this.idEnCours = tech.id;
    this.formData = {
      email: tech.email,
<<<<<<< HEAD
      full_name: tech.full_name,
      phone: tech.phone || '',
      role: tech.role
=======
      password: '',
      first_name: tech.first_name || '',
      last_name: tech.last_name || '',
      date_naissance: tech.date_naissance ? tech.date_naissance.substring(0, 10) : '',
      phone: tech.phone || ''
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
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
        first_name: this.formData.first_name,
        last_name: this.formData.last_name,
        date_naissance: this.formData.date_naissance,
        email: this.formData.email,
        phone: this.formData.phone,
        role: this.formData.role
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
        role: this.formData.role
      }).subscribe({
        next: (res) => {
          this.enregistrement = false;
          this.tempPassword = res.data?.temp_password || '';
          this.chargerTechniciens();
          if (this.tempPassword) {
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
      t.email.toLowerCase().includes(terme)
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
    this.tempPassword = '';
  }

  copierPassword() {
    if (this.tempPassword) {
      navigator.clipboard.writeText(this.tempPassword).then(() => {
        // Could add a toast notification here
      }).catch(err => {
        console.error('Erreur lors de la copie:', err);
      });
    }
  }
}