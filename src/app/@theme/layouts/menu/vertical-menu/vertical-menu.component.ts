// Angular import
import { Component, inject, input } from '@angular/core';
import { CommonModule, Location, LocationStrategy } from '@angular/common';

// project import
import { NavigationItem } from 'src/app/@theme/types/navigation';
import { SharedModule } from 'src/app/shared/shared.module';
import { MenuItemComponent } from './menu-item/menu-item.component';
import { MenuCollapseComponent } from './menu-collapse/menu-collapse.component';
import { MenuGroupVerticalComponent } from './menu-group/menu-group.component';
import { NgScrollbarModule } from 'ngx-scrollbar';

// ===========================================
// 1. IMPORTE O AUTHSERVICE
// ===========================================
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-vertical-menu',
  imports: [SharedModule, MenuItemComponent, MenuCollapseComponent, MenuGroupVerticalComponent, CommonModule, NgScrollbarModule],
  templateUrl: './vertical-menu.component.html',
  styleUrls: ['./vertical-menu.component.scss']
})
export class VerticalMenuComponent {
  private location = inject(Location);
  private locationStrategy = inject(LocationStrategy);

  public authService = inject(AuthService);

  // public props
  menus = input.required<NavigationItem[]>();

  // public method
  fireOutClick() {
    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[ href='" + current_url + "' ]";
    const ele = document.querySelector(link);
    if (ele !== null && ele !== undefined) {
      const parent = ele.parentElement;
      const up_parent = parent?.parentElement?.parentElement;
      const last_parent = up_parent?.parentElement;
      if (parent?.classList.contains('coded-hasmenu')) {
        parent.classList.add('coded-trigger');
        parent.classList.add('active');
      } else if (up_parent?.classList.contains('coded-hasmenu')) {
        up_parent.classList.add('coded-trigger');
        up_parent.classList.add('active');
      } else if (last_parent?.classList.contains('coded-hasmenu')) {
        last_parent.classList.add('coded-trigger');
        last_parent.classList.add('active');
      }
    }
  }

  accountList = [
    {
      icon: 'ti ti-power',
      title: 'Logout',
      click: () => this.onLogout()
    }
  ];

  onLogout(): void {
    this.authService.logout();
  }

  // ===========================================
  // NOVA FUNÇÃO: GERA AS INICIAIS
  // ===========================================
  /**
   * Retorna as duas primeiras iniciais de um nome.
   * Ex: "Jonh Smith" -> "JS"
   * Ex: "Ana" -> "A"
   */
  getUserInitials(): string {
    const name = this.authService.nome;
    if (!name) {
      return '?'; // Ou um fallback se o nome não estiver disponível
    }

    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) {
      return '?';
    }

    let initials = parts[0].charAt(0);
    if (parts.length > 1) {
      initials += parts[1].charAt(0);
    }

    return initials.toUpperCase();
  }
}
