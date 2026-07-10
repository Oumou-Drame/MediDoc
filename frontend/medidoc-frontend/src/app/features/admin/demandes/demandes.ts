import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PlatformService } from '../../../core/services/platform-service';

interface HospitalRequest {
  id: number;
  hospital_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  numero_agrement: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  document_status: 'not_required' | 'pending' | 'verified' | 'rejected';
  created_at: string;
}

@Component({
  selector: 'app-demandes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demandes.html',
  styleUrl: './demandes.css',
})
export class Demandes implements OnInit {
  private platformService = inject(PlatformService);
  private router = inject(Router);

  chargement = true;
  requests: HospitalRequest[] = [];

  ngOnInit(): void {
    this.charger();
  }

  charger() {
    this.chargement = true;
    this.platformService.getRequests('pending').subscribe({
      next: (res) => { this.requests = res.data; this.chargement = false; },
      error: () => { this.chargement = false; }
    });
  }

  ouvrirDetail(r: HospitalRequest) {
    this.router.navigateByUrl(`/admin/demandes/${r.id}`);
  }
}
