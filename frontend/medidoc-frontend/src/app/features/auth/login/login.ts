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
    password:string ='';
    router:Router=inject(Router);
    AuthService:AuthService = inject(AuthService);
    LoginRequest: LoginRequest = {username: '', password: ''}
  connection() {
  this.LoginRequest.username = this.name;
  this.LoginRequest.password = this.password;

  this.AuthService.login(this.LoginRequest).subscribe({
    next: (value: LoginResponse) => {
      console.log(value);
       const role = value.user.role;
   if (role === 'admin') {
      this.router.navigateByUrl('/admin/dashboard');
    } else {
      this.router.navigateByUrl('/technicien');
    }
    },
    error: (err) => {
      console.log(err);
      alert('Email ou mot de passe incorrect');
    },
    complete() {
      console.log('Authentification terminée');
    }
  });
}
}
