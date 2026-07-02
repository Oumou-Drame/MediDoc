import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../../core/services/platform-service';

interface HospitalBalance {
  hospital_id: number;
  hospital_name: string;
  balance: string;
}

@Component({
  selector: 'app-credits-plateforme',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './credits-plateforme.html',
  styleUrl: './credits-plateforme.css',
})
export class CreditsPlateforme implements OnInit {
  private platformService = inject(PlatformService);

  chargement = true;
  hospitals: HospitalBalance[] = [];
  total = 0;

  hopitalEnCours: number | null = null;
  montantAllocation: number | null = null;
  noteAllocation = '';
  allocationEnCours = false;

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.platformService.getCreditsOverview().subscribe({
      next: (res) => {
        this.hospitals = res.data.hospitals;
        this.total = res.data.total_virtual_balance;
        this.chargement = false;
      },
      error: () => { this.chargement = false; }
    });
  }

  ouvrirAllocation(h: HospitalBalance) {
    this.hopitalEnCours = h.hospital_id;
    this.montantAllocation = null;
    this.noteAllocation = '';
  }

  annulerAllocation() {
    this.hopitalEnCours = null;
  }

  allouer(h: HospitalBalance) {
    if (!this.montantAllocation || this.montantAllocation <= 0) return;
    this.allocationEnCours = true;
    this.platformService.allocateCredits(h.hospital_id, this.montantAllocation, this.noteAllocation || undefined).subscribe({
      next: () => {
        this.allocationEnCours = false;
        this.hopitalEnCours = null;
        this.charger();
      },
      error: (err) => {
        this.allocationEnCours = false;
        alert(err.error?.error || "Erreur lors de l'allocation");
      }
    });
  }
}
