import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardResponse } from '../../features/admin/models/dashbord-stats';
import { Observable } from 'rxjs';
import { ParametresApp } from '../../features/admin/models/settings';
import { ActiviteResponse, Auteur } from '../../features/admin/models/activite';


@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http: HttpClient = inject(HttpClient);
  // Paramètres plateforme (rôle admin uniquement, aucune donnée patient)
  private apiUrl = 'http://localhost:5000/api/admin';
  // Dashboard + comptes techniciens : niveau hôpital (rôle responsable de labo)
  private labManagerUrl = 'http://localhost:5000/api/lab-manager';

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.labManagerUrl}/dashboard`, { withCredentials: true });
  }
  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.labManagerUrl}/technicians`, { withCredentials: true });
  }

  createUser(payload: any): Observable<any> {
    return this.http.post<any>(`${this.labManagerUrl}/technicians`, payload, { withCredentials: true });
  }

  updateUser(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.labManagerUrl}/technicians/${id}`, payload, { withCredentials: true });
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

  // Journal d'activité de l'équipe de l'hôpital
  getActivite(params: { action?: string; technicien?: number; search?: string; date_debut?: string; date_fin?: string; page?: number; limit?: number }): Observable<ActiviteResponse> {
    const qs = new URLSearchParams();
    if (params.action) qs.set('action', params.action);
    if (params.technicien) qs.set('technicien', String(params.technicien));
    if (params.search) qs.set('search', params.search);
    if (params.date_debut) qs.set('date_debut', params.date_debut);
    if (params.date_fin) qs.set('date_fin', params.date_fin);
    qs.set('page', String(params.page || 1));
    qs.set('limit', String(params.limit || 20));
    return this.http.get<ActiviteResponse>(`${this.labManagerUrl}/activite?${qs.toString()}`, { withCredentials: true });
  }

  getActiviteAuteurs(): Observable<{ success: boolean; data: Auteur[] }> {
    return this.http.get<any>(`${this.labManagerUrl}/activite/auteurs`, { withCredentials: true });
  }

}
