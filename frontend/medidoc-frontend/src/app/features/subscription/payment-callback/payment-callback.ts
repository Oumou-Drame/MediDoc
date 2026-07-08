import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SubscriptionService } from '../../../core/services/subscription-service';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="payment-callback-container">
      <div class="payment-card">
        @if (chargement) {
          <div class="loading-state">
            <div class="spinner"></div>
            <h2>Vérification du paiement en cours...</h2>
            <p>Veuillez patienter pendant que nous vérifions votre transaction.</p>
          </div>
        } @else if (success) {
          <div class="success-state">
            <div class="success-icon">✓</div>
            <h2>Paiement réussi !</h2>
            <p>Votre abonnement a été activé avec succès.</p>
            <button (click)="navigateToDashboard()" class="btn-primary">
              Accéder au tableau de bord
            </button>
          </div>
        } @else if (error) {
          <div class="error-state">
            <div class="error-icon">✕</div>
            <h2>Échec du paiement</h2>
            <p>{{ errorMessage }}</p>
            <button (click)="retournerAuxPacks()" class="btn-secondary">
              Retourner aux packs
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './payment-callback.css'
})
export class PaymentCallback {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private subscriptionService = inject(SubscriptionService);
  private authService = inject(AuthService);

  chargement = true;
  success = false;
  error = false;
  errorMessage = '';

  ngOnInit() {
    // Récupérer le paramètre reference de l'URL
    this.route.queryParams.subscribe(params => {
      const reference = params['reference'];
      
      if (reference) {
        this.verifierPaiement(reference);
      } else {
        this.error = true;
        this.errorMessage = 'Référence de transaction manquante';
        this.chargement = false;
      }
    });
  }

  verifierPaiement(reference: string) {
    this.subscriptionService.verifyPayment(reference).subscribe({
      next: (res) => {
        this.chargement = false;

        if (res.data.status === 'success') {
          this.success = true;
          // Rafraîchir l'utilisateur puis naviguer explicitement vers le dashboard
          this.authService.getMe().subscribe({
            next: () => {
              this.authService.updateCurrentUser({ has_chosen_plan: true });
              this.navigateToDashboard();
            },
            error: () => {
              this.router.navigate(['/login']);
            }
          });
        } else {
          this.error = true;
          this.errorMessage = res.data.message || 'Le paiement n\'a pas abouti';
        }
      },
      error: (err) => {
        this.chargement = false;
        this.error = true;
        this.errorMessage = err.error?.error || 'Erreur lors de la vérification du paiement';
      }
    });
  }

  navigateToDashboard() {
    try {
      const result = this.router.navigate(['/lab-manager/dashboard']);
      if (!(result instanceof Promise)) {
        window.location.href = '/lab-manager/dashboard';
      } else if (result && typeof result.catch === 'function') {
        result.catch(() => {
          window.location.href = '/lab-manager/dashboard';
        });
      }
    } catch {
      window.location.href = '/lab-manager/dashboard';
    }
  }

  retournerAuxPacks() {
    this.router.navigate(['/subscription/choix-abonnement']);
  }
}
