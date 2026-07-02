import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HospitalRequestPayload {
  hospital_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RegistrationService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/hospitals';

  submitRequest(payload: HospitalRequestPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/request`, payload);
  }
}
