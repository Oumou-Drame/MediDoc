import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../../shared/layout/sidebar/sidebar';

// Coquille générique (logo + sidebar + zone de contenu), réutilisée pour les 3 rôles
// (admin, responsable de labo, technicien) et pour la page profil. Le contenu de la
// sidebar elle-même s'adapte au rôle courant — voir shared/layout/sidebar.
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [Sidebar, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
}
