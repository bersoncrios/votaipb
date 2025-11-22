import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SharedModule } from 'src/app/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [SharedModule, RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss', '../../authentication.scss']
})
export class ResetPasswordComponent {
  private fb: FormBuilder = inject(FormBuilder);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  resetForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  resetError = '';

  get email() {
    return this.resetForm.get('email');
  }

  getErrorMessage() {
    if (this.email?.hasError('required')) {
      return 'You must enter an email';
    }
    return this.email?.hasError('email') ? 'Not a valid email' : '';
  }

  resetPassword() {
    this.resetError = '';
    if (this.resetForm.invalid) return;

    const { email } = this.resetForm.value;

    this.authService.resetPassword(email)
      .then(() => {
        Swal.fire(
          'E-mail enviado!',
          'Enviamos um link para redefinir sua senha. Verifique sua caixa de entrada.',
          'success'
        );
        this.resetForm.reset();
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      })
      .catch(error => {
        let msg = 'Erro ao enviar e-mail de redefinição. Tente novamente.';
        if (error.code === 'auth/user-not-found') {
          msg = 'E-mail não encontrado.';
        }
        this.resetError = msg;
        Swal.fire('Erro', msg, 'error');
      });
  }
}
