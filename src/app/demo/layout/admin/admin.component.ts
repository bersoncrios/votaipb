import { Component, OnInit, inject, viewChild, OnDestroy } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { menus } from 'src/app/demo/data/menu';
import { LayoutService } from 'src/app/@theme/services/layout.service';
import { environment } from 'src/environments/environment';
import { FooterComponent } from 'src/app/@theme/layouts/footer/footer.component';
import { SharedModule } from '../../../shared/shared.module';
import { RouterModule } from '@angular/router';
import { NavBarComponent } from 'src/app/@theme/layouts/toolbar/toolbar.component';
import { VerticalMenuComponent } from 'src/app/@theme/layouts/menu/vertical-menu';
import { AuthService } from 'src/app/services/auth.service';
import { Navigation } from 'src/app/@theme/types/navigation';

@Component({
  selector: 'app-admin',
  imports: [FooterComponent, SharedModule, RouterModule, NavBarComponent, VerticalMenuComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
  private breakpointObserver = inject(BreakpointObserver);
  private layoutService = inject(LayoutService);
  private authService = inject(AuthService);
  private roleCheckInterval: any;

  sidebar = viewChild<MatDrawer>('sidebar');
  menus: Navigation[] = menus;
  modeValue: MatDrawerMode = 'side';
  currentApplicationVersion = environment.appVersion;

  ngOnInit() {
    // Atualiza menus imediatamente
    this.updateMenus();

    // Verifica role periodicamente até carregar (para casos de navegação direta)
    this.roleCheckInterval = setInterval(() => {
      if (this.authService.role) {
        this.updateMenus();
        clearInterval(this.roleCheckInterval);
      }
    }, 100);

    // Para o intervalo após 5 segundos de qualquer forma
    setTimeout(() => {
      if (this.roleCheckInterval) {
        clearInterval(this.roleCheckInterval);
      }
    }, 5000);

    this.breakpointObserver.observe(['(min-width: 1025px)', '(max-width: 1024.98px)']).subscribe((result) => {
      if (result.breakpoints['(max-width: 1024.98px)']) {
        this.modeValue = 'over';
      } else if (result.breakpoints['(min-width: 1025px)']) {
        this.modeValue = 'side';
      }
    });

    this.layoutService.layoutState.subscribe(() => {
      this.sidebar()?.toggle();
    });
  }

  ngOnDestroy() {
    if (this.roleCheckInterval) {
      clearInterval(this.roleCheckInterval);
    }
  }

  private updateMenus() {
    const isAdmin = this.authService.role === 'admin';
    this.menus = menus.filter(menu => !menu.adminOnly || isAdmin);
  }
}

