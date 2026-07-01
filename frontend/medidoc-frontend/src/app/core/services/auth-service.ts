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

  private _currentUser: any = null;

  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      loginRequest,
      { withCredentials: true }
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
      map((user) => {
        this._currentUser = user;
        return true;
      }),
      catchError(() => of(false))
    );
  }

  // Récupère l'utilisateur courant (après getMe/isLogin)
  get currentUser(): any {
    return this._currentUser;
  }

  // Modifier le profil
  updateProfile(data: { full_name?: string; phone?: string; date_naissance?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, data, { withCredentials: true });
  }

  // Changer le mot de passe
  changePassword(data: { current_password: string; new_password: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/password`, data, { withCredentials: true });
  }
}