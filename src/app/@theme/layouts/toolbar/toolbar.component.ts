import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from 'src/app/shared/shared.module';
import { NavRightComponent } from './toolbar-right/toolbar-right.component';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-nav-bar',
  imports: [SharedModule, RouterModule, NavRightComponent],
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class NavBarComponent {
  public authService = inject(AuthService);
}

