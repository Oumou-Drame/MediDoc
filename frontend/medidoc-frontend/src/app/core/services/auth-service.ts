import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LoginRequest } from '../../features/auth/models/LoginRequest';
import { LoginResponse } from '../../features/auth/models/LoginResponse';
import { Observable, map, catchError, of, tap } from 'rxjs';
import { CurrentUser } from '../models/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/auth';

  // Utilisateur courant mis en cache après /login ou /me, consommé par la sidebar et le profil.
  private currentUserValue: CurrentUser | null = null;

  get currentUser(): CurrentUser | null {
    return this.currentUserValue;
  }

  // Permet à d'autres écrans (ex: page Profil) de garder le cache partagé à jour
  // sans refaire un appel /me — utile pour que la Sidebar (montée une seule fois) reflète
  // immédiatement un changement de vue ou de capacité technicien fait depuis le Profil.
  updateCurrentUser(partial: Partial<CurrentUser>) {
    if (this.currentUserValue) {
      this.currentUserValue = { ...this.currentUserValue, ...partial };
    }
  }

  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      loginRequest,
      { withCredentials: true }   //  obligatoire pour envoyer/recevoir le cookie
    ).pipe(
      tap((res) => { this.currentUserValue = res.user; })
    );
  }

  getMe(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.apiUrl}/me`, { withCredentials: true }).pipe(
      tap((user) => { this.currentUserValue = user; })
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => { this.currentUserValue = null; })
    );
  }

  // Vérifie si l'utilisateur doit choisir un pack (première connexion après validation)
  hasChosenPlan(): Observable<boolean> {
    return this.getMe().pipe(
      map((user: any) => user.has_chosen_plan === true),
      catchError(() => of(false))
    );
  }

  // Vérifie la connexion en interrogeant le serveur (le cookie est HttpOnly, invisible en JS)
  isLogin(): Observable<boolean> {
    return this.getMe().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, password });
  }
}
