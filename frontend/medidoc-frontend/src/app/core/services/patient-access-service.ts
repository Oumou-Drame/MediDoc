import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PatientInfo, VerifyResponse } from '../../features/patient/models/patient-access';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PatientAccessService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/patient`;

  getInfo(token: string): Observable<{ success: boolean; data: PatientInfo }> {
    return this.http.get<any>(`${this.apiUrl}/info/${token}`);
  }

  verify(token: string, code: string): Observable<{ success: boolean; data: VerifyResponse }> {
    return this.http.post<any>(`${this.apiUrl}/verify`, { token, code });
  }
}
