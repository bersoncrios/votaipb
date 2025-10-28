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

  // Seu código existente para dados de exemplo (pode remover se não usar)
  mainCards = [
    {
      day: 'Today',
      cards: [
        {
          icon: 'custom-layer',
          time: '2 min ago',
          position: 'UI/UX Design',
          description:
            "Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley oftype and scrambled it to make a type",
          status: false
        },
        {
          icon: 'custom-sms',
          time: '1 hour ago',
          position: 'Message',
          description: "Lorem Ipsum has been the industry's standard dummy text ever since the 1500.",
          status: false
        }
      ]
    },
    {
      day: 'Yesterday',
      cards: [
        {
          icon: 'custom-document-text',
          time: '12 hour ago',
          position: 'Forms',
          description:
            "Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley oftype and scrambled it to make a type",
          status: false
        },
        {
          icon: 'custom-security-safe',
          time: '18 hour ago',
          position: 'Security',
          description: "Lorem Ipsum has been the industry's standard dummy text ever since the 1500.",
          status: false
        },
        {
          icon: 'custom-user-bold',
          time: '15 hour ago',
          position: 'Challenge invitation',
          description: 'Jonny aber invites to join the challenge',
          status: true
        }
      ]
    }
  ];

  notification = [
     {
      sub_title: 'Improvement',
      time: '12 hour ago',
      title: 'Widgets update',
      img: 'assets/images/layout/img-announcement-3.png'
    },
    {
      sub_title: 'New Feature',
      time: '18 hour ago',
      title: 'Coming soon dark mode',
      img: 'assets/images/layout/img-announcement-4.png'
    }
  ];
}
