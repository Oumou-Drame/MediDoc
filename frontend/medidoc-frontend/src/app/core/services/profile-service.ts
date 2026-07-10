import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActiveView } from '../models/user';
import { environment } from '../../../environments/environment';

export interface ProfileData {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  hospital_id: number | null;
  is_technician: boolean;
  active_view: ActiveView | null;
  created_at: string;
  roles: string[];
  hospital: { id: number; name: string } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/profile`;

  getProfile(): Observable<{ success: boolean; data: ProfileData }> {
    return this.http.get<any>(this.apiUrl, { withCredentials: true });
  }

  updateProfile(payload: { full_name: string; phone?: string }): Observable<any> {
    return this.http.put<any>(this.apiUrl, payload, { withCredentials: true });
  }

  changePassword(payload: { current_password: string; new_password: string; confirm_password: string }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/password`, payload, { withCredentials: true });
  }

  switchView(view: ActiveView): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/view`, { view }, { withCredentials: true });
  }

  toggleTechnicianCapacity(active: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/technician-capacity`, { active }, { withCredentials: true });
  }
}
