import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// project imports
import { SharedModule } from 'src/app/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [SharedModule, RouterModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss', '../authentication.scss']
})
export class RegisterComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  hide = true;
  coHide = true;
  registerError = '';

  // Reactive form
  registerForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
    terms: [false, Validators.requiredTrue]
  });

  // Getters para facilitar acesso no template
  get email() {
    return this.registerForm.get('email');
  }
  get password() {
    return this.registerForm.get('password');
  }
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }

  getErrorMessage() {
    if (this.email?.hasError('required')) {
      return 'Você deve informar um email';
    }
    return this.email?.hasError('email') ? 'Email inválido' : '';
  }

  async register() {
    this.registerError = '';
    if (this.registerForm.invalid) return;

    const { firstName, lastName, email, password, confirmPassword } = this.registerForm.value;

    if (password !== confirmPassword) {
      this.registerError = 'As senhas não coincidem';
      return;
    }

    this.authService.signup({
      email, password,
      id: '',
      name: '',
      userId: '',
      role: ''
    }).subscribe({
      next: async (res: any) => {
        if (res?.user) {
          const user = res.user;
          const token = await user.getIdToken();
          const uid = user.uid;

          console.log('Usuário registrado:', { user, token, uid });
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('uid', uid);

          // salvar dados extras no Firestore
          await this.authService.createData({
            id: '',
            name: `${firstName} ${lastName}`,
            email,
            password,
            userId: uid,
            role: 'user'
          });

          this.router.navigate(['/dashboard']);
        } else if (res?.error) {
          this.registerError = res.error.message || 'Erro ao registrar usuário';
        }
      },
      error: (err: any) => {
        sessionStorage.clear();
        console.error(err);
        this.registerError = 'Erro ao registrar usuário';
      }
    });
  }
}
