import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CanalOption, UploadResponse } from '../../features/technicien/models/upload';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/upload';

  getFormData(): Observable<{ channels: CanalOption[] }> {
    return this.http.get<{ channels: CanalOption[] }>(`${this.apiUrl}/form-data`, { withCredentials: true });
  }

  envoyerResultat(donnees: FormData): Observable<{ success: boolean; message: string; data: UploadResponse }> {
    return this.http.post<any>(this.apiUrl, donnees, { withCredentials: true });
  }
}
