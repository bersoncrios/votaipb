import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Importado para routerLink
import {
  DashboardService,
  EleicaoStats,
} from '../../../../services/dash.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArchive,
  faCalendarAlt,
  faSyncAlt,
  faCheckCircle,
  faExclamationTriangle,
  faLock,
  faBolt,
  faMobileAlt,
  faFileInvoice,
  faArrowRight
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard-publico',
  templateUrl: './general-dashoard.component.html',
  styleUrls: ['./general-dashoard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    RouterModule // Adicionado aos imports
  ]
})
export class DashboardPublicoComponent implements OnInit {

  // Ícones existentes
  faArchive = faArchive;
  faCalendarAlt = faCalendarAlt;
  faSyncAlt = faSyncAlt;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;

  // Novos ícones para a LP
  faLock = faLock;
  faBolt = faBolt;
  faMobileAlt = faMobileAlt;
  faFileInvoice = faFileInvoice;
  faArrowRight = faArrowRight;

  private dashboardService = inject(DashboardService);
  public stats: EleicaoStats | null = null;
  public isLoading = true;

  async ngOnInit() {
    this.isLoading = true;
    try {
      this.stats = await this.dashboardService.getEstatisticasEleicoes();
    } catch (error) {
      console.error("Falha ao carregar estatísticas", error);
    } finally {
      this.isLoading = false;
    }
  }
}
