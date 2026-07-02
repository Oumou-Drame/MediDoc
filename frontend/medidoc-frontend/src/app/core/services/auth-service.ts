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
<<<<<<< HEAD
   private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/auth';

  private _currentUser: any = null;
=======
  private http: HttpClient = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/auth';
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a

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
<<<<<<< HEAD
      { withCredentials: true }
=======
      { withCredentials: true }   //  obligatoire pour envoyer/recevoir le cookie
    ).pipe(
      tap((res) => { this.currentUserValue = res.user; })
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
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

  // Vérifie la connexion en interrogeant le serveur (le cookie est HttpOnly, invisible en JS)
  isLogin(): Observable<boolean> {
    return this.getMe().pipe(
      map((user) => {
        this._currentUser = user;
        return true;
      }),
      catchError(() => of(false))
    );
  }

<<<<<<< HEAD
  // Récupère l'utilisateur courant (après getMe/isLogin)
  get currentUser(): any {
    return this._currentUser;
  }

  // Modifier le profil
  updateProfile(data: { full_name?: string; phone?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, data, { withCredentials: true });
  }

  // Changer le mot de passe
  changePassword(data: { current_password: string; new_password: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/password`, data, { withCredentials: true });
  }

  // Mot de passe oublié
=======
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

<<<<<<< HEAD
  // Réinitialiser le mot de passe
  resetPassword(token: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, new_password });
  }
}
=======
  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, password });
  }
}
>>>>>>> 762d4911a37f514379d908ed155a5e662fcf658a
