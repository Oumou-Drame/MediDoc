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
  private apiUrl = 'http://localhost:3000/api/admin';

  getDashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.apiUrl}/dashboard`, { withCredentials: true });
  }
  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users`, { withCredentials: true });
  }

  createUser(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users`, payload, { withCredentials: true });
  }

  updateUser(id: number, payload: Partial<any>): Observable<{ success: boolean; data?: any }> {
    return this.http.put<{ success: boolean; data?: any }>(`${this.apiUrl}/users/${id}`, payload, { withCredentials: true });
  }

  toggleUser(id: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/${id}/toggle`, {}, { withCredentials: true });
  }
  deleteUser(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/users/${id}`, { withCredentials: true });
  }
  getSettings(): Observable<{ success: boolean; data: ParametresApp }> {
    return this.http.get<any>(`${this.apiUrl}/settings`, { withCredentials: true });
  }

  updateSettings(payload: Partial<ParametresApp>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/settings`, payload, { withCredentials: true });
  }

}
