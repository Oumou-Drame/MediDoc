import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  features: {
    max_technicians: number;
    whatsapp: boolean;
    email: boolean;
    sms: boolean;
    monthly_sends: number;
    statistics: string;
    history_days: number;
    support: string;
    api_access: boolean;
  };
}

export interface HospitalSubscription {
  id: number;
  hospital_id: number;
  plan_id: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  start_date: string | null;
  end_date: string | null;
  plan_name: string;
  price: number;
  currency: string;
  features: any;
  hospital_name?: string;
  contact_name?: string;
  contact_email?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/subscription`;
  private paymentUrl = `${environment.apiUrl}/payment`;

  getPlans(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/plans`, { withCredentials: true });
  }

  getMySubscription(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/my`, { withCredentials: true });
  }

  choosePlan(planId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/choose`, { plan_id: planId }, { withCredentials: true });
  }

  initializePayment(planId: number, email: string, amount: number): Observable<any> {
    return this.http.post<any>(`${this.paymentUrl}/initialize`,
      { plan_id: planId, email, amount },
      { withCredentials: true }
    );
  }

  verifyPayment(reference: string): Observable<any> {
    return this.http.get<any>(`${this.paymentUrl}/verify/${reference}`, { withCredentials: true });
  }

  // Vue admin : liste des abonnements en attente de validation manuelle
  getAdminSubscriptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/subscriptions`, { withCredentials: true });
  }

  validateSubscription(id: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/subscriptions/${id}/validate`, { transaction_id: 'MANUAL-' + Date.now() }, { withCredentials: true });
  }

  rejectSubscription(id: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/subscriptions/${id}/reject`, {}, { withCredentials: true });
  }
}