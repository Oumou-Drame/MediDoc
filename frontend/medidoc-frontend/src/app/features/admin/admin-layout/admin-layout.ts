import { Component } from '@angular/core';
<<<<<<< HEAD
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../../core/components/sidebar/sidebar';
=======
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../../../shared/layout/sidebar/sidebar';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

// Coquille générique (logo + sidebar + zone de contenu), réutilisée pour les 3 rôles
// (admin, responsable de labo, technicien) et pour la page profil. Le contenu de la
// sidebar elle-même s'adapte au rôle courant — voir shared/layout/sidebar.
@Component({
  selector: 'app-admin-layout',
<<<<<<< HEAD
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {}
=======
  standalone: true,
  imports: [Sidebar, RouterOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
}
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
