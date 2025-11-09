import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard-publico',
  templateUrl: './general-dashoard.component.html',
  styleUrls: ['./general-dashoard.component.scss'],
  standalone: true,
imports: [CommonModule, FontAwesomeModule]
})
export class DashboardPublicoComponent implements OnInit {

  faArchive = faArchive;
  faCalendarAlt = faCalendarAlt;
  faSyncAlt = faSyncAlt;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
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
