// angular import
import { Component, inject } from '@angular/core';
import { NgScrollbarModule } from 'ngx-scrollbar';

// project import
import { SharedModule } from 'src/app/shared/shared.module';
// ===========================================
// 1. IMPORTE O AUTHSERVICE
// ===========================================
import { AuthService } from 'src/app/services/auth.service'; // Ajuste o caminho se necessário

@Component({
  selector: 'app-nav-right', // Certifique-se que este seletor está correto
  imports: [SharedModule, NgScrollbarModule],
  standalone: true, // Adicionado se for standalone
  templateUrl: './toolbar-right.component.html',
  styleUrls: ['./toolbar-right.component.scss']
})
export class NavRightComponent {
  // ===========================================
  // 2. INJETE O AUTHSERVICE E TORNE-O PÚBLICO
  // ===========================================
  public authService = inject(AuthService);

  // ===========================================
  // 3. ADICIONE A FUNÇÃO GET USER INITIALS
  // ===========================================
  /**
   * Retorna as duas primeiras iniciais de um nome.
   */
  getUserInitials(): string {
    const name = this.authService.nome; // Usa a propriedade pública 'nome' do AuthService
    if (!name) {
      return '?'; // Fallback
    }

    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) {
      return '?';
    }

    let initials = parts[0].charAt(0);
    // Pega a inicial do último nome se houver mais de um nome
    if (parts.length > 1) {
      initials += parts[parts.length - 1].charAt(0);
    }

    return initials.toUpperCase();
  }

}
