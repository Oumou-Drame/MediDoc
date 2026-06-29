import { Component } from '@angular/core';
import { FormsModule} from '@angular/forms';
import { inject } from '@angular/core';
import { Router} from '@angular/router';
import { AuthService } from '../../../core/services/auth-service';
import { LoginRequest } from '../models/LoginRequest';
import { LoginResponse } from '../models/LoginResponse';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
   name:string = '';
   password:string = '';
   loading: boolean = false;
   errorMessage: string = '';
   router:Router=inject(Router);
   AuthService:AuthService = inject(AuthService);
   LoginRequest: LoginRequest = {username: '', password: ''}

  connection() {
    // Reset error
    this.errorMessage = '';
    
    // Basic validation
    if (!this.name.trim() || !this.password.trim()) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.loading = true;
    this.LoginRequest.username = this.name;
    this.LoginRequest.password = this.password;

    this.AuthService.login(this.LoginRequest).subscribe({
      next: (value: LoginResponse) => {
        this.loading = false;
        const role = value.user.role;
        if (role === 'admin') {
          this.router.navigateByUrl('/admin/dashboard');
        } else {
          this.router.navigateByUrl('/technicien');
        }
      },
      error: (err) => {
        this.loading = false;
        console.log(err);
        if (err.status === 400) {
          this.errorMessage = 'Identifiant ou mot de passe incorrect';
        } else if (err.status === 0) {
          this.errorMessage = 'Impossible de se connecter au serveur';
        } else {
          this.errorMessage = 'Erreur de connexion. Veuillez réessayer.';
        }
      },
    });
  }
}