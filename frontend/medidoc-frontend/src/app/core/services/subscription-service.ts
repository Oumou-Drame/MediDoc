import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private apiUrl = 'http://localhost:5000/api/subscription';

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
    return this.http.post<any>('http://localhost:5000/api/payment/initialize', 
      { plan_id: planId, email, amount }, 
      { withCredentials: true }
    );
  }

  verifyPayment(reference: string): Observable<any> {
    return this.http.get<any>(`http://localhost:5000/api/payment/verify/${reference}`, { withCredentials: true });
  }
}