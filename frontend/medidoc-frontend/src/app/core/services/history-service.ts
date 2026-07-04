import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HistoryResponse,ResultatMedical } from '../../features/admin/models/history';
@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/history';

  getHistory(params: { status?: string; search?: string; page?: number; limit?: number }): Observable<HistoryResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    qs.set('page', (params.page || 1).toString());
    qs.set('limit', (params.limit || 20).toString());

    return this.http.get<HistoryResponse>(`${this.apiUrl}?${qs.toString()}`, { withCredentials: true });
  }
  getDetail(id: number): Observable<{ success: boolean; data: ResultatMedical }> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  unlock(id: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/unlock`, {}, { withCredentials: true });
  }

  cancel(id: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/cancel`, {}, { withCredentials: true });
  }
}
