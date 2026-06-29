import { Injectable,inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequest} from '../../features/auth/models/LoginRequest';
import { LoginResponse} from '../../features/auth/models/LoginResponse';
import { Observable,map,catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
   private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/auth';

  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      loginRequest,
      { withCredentials: true }   //  obligatoire pour envoyer/recevoir le cookie
    );
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`, { withCredentials: true });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true });
  }

  // Vérifie la connexion en interrogeant le serveur (le cookie est HttpOnly, invisible en JS)
  isLogin(): Observable<boolean> {
    return this.getMe().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}