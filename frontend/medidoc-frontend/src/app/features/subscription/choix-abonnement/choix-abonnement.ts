import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { SubscriptionService, SubscriptionPlan } from '../../../core/services/subscription-service';
import { AuthService } from '../../../core/services/auth-service';

@Component({
  selector: 'app-choix-abonnement',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './choix-abonnement.html',
  styleUrl: './choix-abonnement.css'
})
export class ChoixAbonnement {
  private subscriptionService = inject(SubscriptionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  plans: SubscriptionPlan[] = [];
  chargement = false;
  erreur = '';
  choixEnCours = false;
  message = '';

  ngOnInit() {
    this.chargerPlans();
  }

  setMessage(msg: string) {
    this.message = msg;
    console.log('[choix-abonnement]', msg);
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

  choisirPack(planId: number) {
    this.setMessage(`Clic OK sur pack ${planId}`);
    
    // Reset erreur et activer le chargement visuel
    this.erreur = '';
    this.choixEnCours = true;
    
    try {
      // Vérifier si l'utilisateur est connecté (cookie + cache)
      if (!this.authService.currentUser) {
        this.setMessage('Utilisateur non connecté, vérification session...');
        // Forcer la vérification de la session via /me
        this.authService.getMe().subscribe({
          next: (user) => {
            this.setMessage('Utilisateur authentifié');
            this.proceedWithPlanChoice(planId);
          },
          error: (err) => {
            this.setMessage('Session invalide');
            this.choixEnCours = false;
            this.erreur = "Vous devez être connecté pour choisir un pack";
            this.router.navigate(['/login']).catch(() => {});
          }
        });
      } else {
        this.setMessage('Utilisateur déjà connecté');
        this.proceedWithPlanChoice(planId);
      }
    } catch (e) {
      this.setMessage('Erreur inattendue dans choisirPack');
      this.choixEnCours = false;
      this.erreur = "Une erreur inattendue s'est produite";
    }
  }

  proceedWithPlanChoice(planId: number) {
    this.setMessage(`Appel choosePlan pour pack ${planId}...`);
    this.subscriptionService.choosePlan(planId).subscribe({
      next: (res) => {
        this.setMessage(`choosePlan OK: requires_payment=${res.requires_payment}`);
        this.choixEnCours = false;
        
        // Si le plan est gratuit, activer immédiatement et rediriger
        if (!res.requires_payment) {
          this.setMessage('Plan gratuit, redirection vers le dashboard');
          // Recharger les infos utilisateur pour mettre à jour has_chosen_plan
          this.authService.getMe().subscribe({
            next: () => {
              this.router.navigate(['/lab-manager/dashboard']).catch(() => {});
            },
            error: () => {
              // Même si getMe échoue, le plan a été choisi côté serveur
              this.router.navigate(['/lab-manager/dashboard']).catch(() => {});
            }
          });
          return;
        }

        // Si le plan est payant, initialiser le paiement
        const plan = res.plan;
        const email = this.authService.currentUser?.email;
        
        this.setMessage(`Plan payant, initialisation paiement pour email=${email}`);
        
        if (!email) {
          this.erreur = "Email utilisateur non disponible. Veuillez vous reconnecter.";
          return;
        }
        
        if (!plan || !plan.id) {
          this.erreur = "Données du plan invalides. Veuillez réessayer.";
          return;
        }
        
        this.subscriptionService.initializePayment(plan.id, email, plan.price).subscribe({
          next: (paymentRes) => {
            this.setMessage('Paiement initialisé');
            if (paymentRes?.data?.authorization_url) {
              window.location.href = paymentRes.data.authorization_url;
            } else {
              this.erreur = "URL de paiement non reçue. Contactez le support.";
            }
          },
          error: (err) => {
            this.setMessage('Erreur initializePayment');
            this.erreur = err.error?.error || err.message || "Erreur lors de l'initialisation du paiement";
          }
        });
      },
      error: (err) => {
        this.setMessage('Erreur choosePlan');
        this.choixEnCours = false;
        this.erreur = err.error?.error || err.message || "Erreur lors du choix du pack";
      }
    });
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}