import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { Auth } from '@angular/fire/auth';

import { SharedModule } from 'src/app/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [SharedModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss', '../authentication.scss']
})
export class LoginComponent {
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private fb: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);


  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  hide = true;
  loginError = '';

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  getErrorMessage() {
    if (this.email?.hasError('required')) {
      return 'You must enter an email';
    }
    return this.email?.hasError('email') ? 'Not a valid email' : '';
  }

  login() {
    this.loginError = '';
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    this.authService.signin({ email, password }).subscribe({
      next: async (res: any) => {
        if (res?.user) {
          const user = res.user;
          const token = await user.getIdToken();
          const uid = user.uid;

          console.log('Login bem-sucedido:', { user, token, uid });
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('uid', uid);

          this.router.navigate(['/dashboard']);
        } else if (res?.error) {
          this.loginError = res.error.message || 'Erro ao fazer login';
        }
      },
      error: (err: any) => {
        sessionStorage.clear();
        console.error(err);
        this.loginError = 'Erro ao fazer login';
      }
    });
  }
}