import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionService, HospitalSubscription } from '../../../core/services/subscription-service';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.css'
})
export class Subscriptions implements OnInit {
  private subscriptionService = inject(SubscriptionService);

  subscriptions: HospitalSubscription[] = [];
  chargement = false;
  erreur = '';

  ngOnInit() {
    this.chargerSubscriptions();
  }

  chargerSubscriptions() {
    this.chargement = true;
    this.subscriptionService.getAdminSubscriptions().subscribe({
      next: (res) => {
        this.subscriptions = res.data;
        this.chargement = false;
      },
      error: () => {
        this.erreur = "Erreur lors du chargement des abonnements";
        this.chargement = false;
      }
    });
  }

  validerAbonnement(id: number) {
    this.subscriptionService.validateSubscription(id).subscribe({
      next: () => {
        this.chargerSubscriptions();
      },
      error: () => alert("Erreur lors de la validation")
    });
  }

  rejeterAbonnement(id: number) {
    this.subscriptionService.rejectSubscription(id).subscribe({
      next: () => {
        this.chargerSubscriptions();
      },
      error: () => alert("Erreur lors du rejet")
    });
  }

  getStatusLabel(status: string): string {
    switch(status) {
      case 'pending': return 'En attente';
      case 'active': return 'Actif';
      case 'expired': return 'Expiré';
      case 'cancelled': return 'Refusé';
      default: return status;
    }
  }
}