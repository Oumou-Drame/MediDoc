import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlatformService } from '../../../core/services/platform-service';
import { SubscriptionService, SubscriptionPlan } from '../../../core/services/subscription-service';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plans.html',
  styleUrl: './plans.css'
})
export class Plans implements OnInit {
  private platformService = inject(PlatformService);
  private subscriptionService = inject(SubscriptionService);

  plans: SubscriptionPlan[] = [];
  planFeatures = [
    { key: 'max_technicians', label: 'Techniciens' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'sms', label: 'SMS' },
    { key: 'monthly_sends', label: 'Envois/mois' },
    { key: 'statistics', label: 'Statistiques' },
    { key: 'history_days', label: 'Historique' },
    { key: 'support', label: 'Support' },
    { key: 'api_access', label: 'API' }
  ];
  chargement = false;
  erreur = '';

  ngOnInit() {
    this.chargerPlans();
  }

  chargerPlans() {
    this.chargement = true;
    this.subscriptionService.getPlans().subscribe({
      next: (res) => {
        this.plans = res.data;
        this.chargement = false;
      },
      error: () => {
        this.erreur = "Erreur lors du chargement des packs";
        this.chargement = false;
      }
    });
  }

  getFeatureValue(plan: SubscriptionPlan, feature: string): any {
    return (plan.features as any)[feature];
  }

  getFeatureLabel(feature: string, value: any): string {
    switch (feature) {
      case 'max_technicians': return value === -1 ? 'Techniciens illimités' : value + ' techniciens max';
      case 'whatsapp': return value ? 'WhatsApp inclus' : 'WhatsApp non inclus';
      case 'email': return value ? 'Email inclus' : 'Email non inclus';
      case 'sms': return value ? 'SMS inclus' : 'SMS non inclus';
      case 'monthly_sends': return value === -1 ? 'Envois illimités' : value + ' envois/mois';
      case 'statistics': return value === 'basic' ? 'Basiques' : value === 'advanced' ? 'Avancées' : 'Temps réel';
      case 'history_days': return value === -1 ? 'Illimité' : value + ' jours';
      case 'support': return value === 'standard' ? 'Standard' : value === 'priority' ? 'Prioritaire' : 'Dédié 24/7';
      case 'api_access': return value ? 'API disponible' : 'API non disponible';
      default: return String(value);
    }
  }
}