import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../../core/components/sidebar/sidebar';

@Component({
  selector: 'app-technicien-layout',
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './technicien-layout.html',
  styleUrl: './technicien-layout.css',
})
export class TechnicienLayout {}
