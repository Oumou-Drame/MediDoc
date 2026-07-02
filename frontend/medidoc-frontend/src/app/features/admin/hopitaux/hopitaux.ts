import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformService } from '../../../core/services/platform-service';

interface Hospital {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'active' | 'suspended';
  total_users: number;
  credit_balance: string;
  created_at: string;
}

@Component({
  selector: 'app-hopitaux',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hopitaux.html',
  styleUrl: './hopitaux.css',
})
export class Hopitaux implements OnInit {
  private platformService = inject(PlatformService);

  chargement = true;
  hospitals: Hospital[] = [];

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.platformService.getHospitals().subscribe({
      next: (res) => { this.hospitals = res.data; this.chargement = false; },
      error: () => { this.chargement = false; }
    });
  }

  basculerStatut(h: Hospital) {
    const action = h.status === 'active' ? this.platformService.suspendHospital(h.id) : this.platformService.activateHospital(h.id);
    action.subscribe({
      next: () => this.charger(),
      error: (err) => alert(err.error?.error || 'Erreur')
    });
  }
}
