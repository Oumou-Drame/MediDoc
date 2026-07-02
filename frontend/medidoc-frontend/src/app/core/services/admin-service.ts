import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardResponse } from '../../features/admin/models/dashbord-stats';
import { Observable } from 'rxjs';
import { ParametresApp } from '../../features/admin/models/settings';


@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http: HttpClient = inject(HttpClient);
<<<<<<< HEAD
  private apiUrl = 'http://localhost:3000/api/admin';
=======
  // Paramètres plateforme (rôle admin uniquement, aucune donnée patient)
  private apiUrl = 'http://localhost:5000/api/admin';
  // Dashboard + comptes techniciens : niveau hôpital (rôle responsable de labo)
  private labManagerUrl = 'http://localhost:5000/api/lab-manager';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.labManagerUrl}/dashboard`, { withCredentials: true });
  }
  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.labManagerUrl}/technicians`, { withCredentials: true });
  }

  createUser(payload: any): Observable<any> {
    return this.http.post<any>(`${this.labManagerUrl}/technicians`, payload, { withCredentials: true });
  }

<<<<<<< HEAD
  updateUser(id: number, payload: Partial<any>): Observable<{ success: boolean; data?: any }> {
    return this.http.put<{ success: boolean; data?: any }>(`${this.apiUrl}/users/${id}`, payload, { withCredentials: true });
=======
  updateUser(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.labManagerUrl}/technicians/${id}`, payload, { withCredentials: true });
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
  }

  toggleUser(id: number): Observable<any> {
    return this.http.put<any>(`${this.labManagerUrl}/technicians/${id}/toggle`, {}, { withCredentials: true });
  }
  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.labManagerUrl}/technicians/${id}`, { withCredentials: true });
  }
  getSettings(): Observable<{ success: boolean; data: ParametresApp }> {
    return this.http.get<any>(`${this.apiUrl}/settings`, { withCredentials: true });
  }

  updateSettings(payload: Partial<ParametresApp>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/settings`, payload, { withCredentials: true });
  }

  // Configuration d'envoi propre à l'hôpital (email SMTP + numéro SMS/WhatsApp déjà activé côté plateforme)
  getSendConfig(): Observable<any> {
    return this.http.get<any>(`${this.labManagerUrl}/send-config`, { withCredentials: true });
  }

  updateSendConfig(payload: any): Observable<any> {
    return this.http.put<any>(`${this.labManagerUrl}/send-config`, payload, { withCredentials: true });
  }

  testSendConfig(payload: any): Observable<any> {
    return this.http.post<any>(`${this.labManagerUrl}/send-config/test`, payload, { withCredentials: true });
  }

  // Solde de crédits SMS/WhatsApp de l'hôpital
  getCredits(): Observable<any> {
    return this.http.get<any>(`${this.labManagerUrl}/credits`, { withCredentials: true });
  }

}
