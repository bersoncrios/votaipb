import { Component, inject } from '@angular/core';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { SharedModule } from 'src/app/shared/shared.module';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-nav-right',
  imports: [CommonModule, SharedModule, NgScrollbarModule],
  standalone: true,
  templateUrl: './toolbar-right.component.html',
  styleUrls: ['./toolbar-right.component.scss']
})
export class NavRightComponent {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);

  getUserInitials(): string {
    const name = this.authService.nome;
    if (!name) {
      return '?';
    }

    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) {
      return '?';
    }

    let initials = parts[0].charAt(0);
    if (parts.length > 1) {
      initials += parts[parts.length - 1].charAt(0);
    }

    return initials.toUpperCase();
  }

  hasPhoto(): boolean {
    return !!this.authService.photoURL;
  }

  isGoogleLinked(): boolean {
    return !!this.authService.photoURL;
  }

  linkGoogle() {
    this.authService.linkGoogleAccount().subscribe({
      next: (res: any) => {
        if (res?.user && !res?.error) {
          Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Conta Google vinculada com sucesso',
            timer: 2000
          });
        }
      },
      error: (err: any) => {
        console.error('Erro ao vincular:', err);
      }
    });
  }
}
