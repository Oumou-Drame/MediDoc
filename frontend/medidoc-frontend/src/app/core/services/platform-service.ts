import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Service "niveau plateforme" (rôle admin) : hôpitaux, demandes d'inscription, crédits globaux.
// Volontairement séparé d'AdminService (qui gère les paramètres techniques globaux) et de
// tout ce qui touche aux données patient — l'admin plateforme n'y a jamais accès.
@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private http: HttpClient = inject(HttpClient);
  private hospitalsUrl = 'http://localhost:5000/api/hospitals';
  private adminUrl = 'http://localhost:5000/api/admin';

  // Hôpitaux
  getHospitals(): Observable<any> {
    return this.http.get<any>(this.hospitalsUrl, { withCredentials: true });
  }

  suspendHospital(id: number): Observable<any> {
    return this.http.put<any>(`${this.hospitalsUrl}/${id}/suspend`, {}, { withCredentials: true });
  }

  activateHospital(id: number): Observable<any> {
    return this.http.put<any>(`${this.hospitalsUrl}/${id}/activate`, {}, { withCredentials: true });
  }

  // Demandes d'inscription
  getRequests(status?: string): Observable<any> {
    const qs = status ? `?status=${status}` : '';
    return this.http.get<any>(`${this.hospitalsUrl}/requests${qs}`, { withCredentials: true });
  }

  approveRequest(id: number): Observable<any> {
    return this.http.put<any>(`${this.hospitalsUrl}/requests/${id}/approve`, {}, { withCredentials: true });
  }

  rejectRequest(id: number, reason?: string): Observable<any> {
    return this.http.put<any>(`${this.hospitalsUrl}/requests/${id}/reject`, { reason }, { withCredentials: true });
  }

  // Documents de vérification
  getRequestDocuments(requestId: number): Observable<any> {
    return this.http.get<any>(`${this.hospitalsUrl}/request/${requestId}/documents`, { withCredentials: true });
  }

  verifyDocument(requestId: number, docId: number, status: 'verified' | 'rejected', reason?: string): Observable<any> {
    return this.http.put<any>(`${this.hospitalsUrl}/request/${requestId}/documents/${docId}/verify`, { status, reason }, { withCredentials: true });
  }

  // Crédits — vue plateforme
  getCreditsOverview(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/credits`, { withCredentials: true });
  }

  getHospitalTransactions(hospitalId: number): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/credits/${hospitalId}/transactions`, { withCredentials: true });
  }

  allocateCredits(hospitalId: number, amount: number, note?: string): Observable<any> {
    return this.http.post<any>(`${this.adminUrl}/credits/${hospitalId}/allocate`, { amount, note }, { withCredentials: true });
  }

  // Dashboard plateforme (hôpitaux/demandes/crédits, jamais de données patient)
  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.adminUrl}/dashboard`, { withCredentials: true });
  }
}
