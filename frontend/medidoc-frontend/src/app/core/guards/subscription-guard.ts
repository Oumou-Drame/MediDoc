import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth-service';
import { SubscriptionService } from '../services/subscription-service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionGuard implements CanActivate {
  private authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    let user = this.authService.currentUser;
    if (!user || user.role !== 'lab_manager') return true;

    if (user.has_chosen_plan) return true;

    const url = this.router.url || '';
    if (url.includes('/choix-abonnement') || url.includes('/subscription/payment/callback')) {
      return true;
    }

    try {
      user = await firstValueFrom(this.authService.getMe());
      if (user && user.has_chosen_plan) return true;
    } catch {}

    this.router.navigateByUrl('/choix-abonnement');
    return false;
  }
}
