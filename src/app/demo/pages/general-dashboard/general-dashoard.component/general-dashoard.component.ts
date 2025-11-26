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

  // Objeto para exibir os números animados
  public displayStats = {
    total: 0,
    finalizada: 0,
    emAndamento: 0,
    agendada: 0,
    desconhecido: 0
  };

  async ngOnInit() {
    // Inicia zerado
    this.resetDisplayStats();

    try {
      this.stats = await this.dashboardService.getEstatisticasEleicoes();
      if (this.stats) {
        this.animateStats();
      }
    } catch (error) {
      console.error("Falha ao carregar estatísticas", error);
    }
  }

  private resetDisplayStats() {
    this.displayStats = {
      total: 0,
      finalizada: 0,
      emAndamento: 0,
      agendada: 0,
      desconhecido: 0
    };
  }

  private animateStats() {
    if (!this.stats) return;

    const duration = 2000; // Duração da animação em ms
    const steps = 60; // Quadros por segundo aproximado
    const intervalTime = duration / steps;

    const targets = {
      total: this.stats.total,
      finalizada: this.stats.finalizada,
      emAndamento: this.stats.emAndamento,
      agendada: this.stats.agendada,
      desconhecido: this.stats.desconhecido
    };

    const increments = {
      total: targets.total / steps,
      finalizada: targets.finalizada / steps,
      emAndamento: targets.emAndamento / steps,
      agendada: targets.agendada / steps,
      desconhecido: targets.desconhecido / steps
    };

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;

      if (currentStep >= steps) {
        // Garante que os valores finais sejam exatos
        this.displayStats = { ...targets };
        clearInterval(timer);
      } else {
        this.displayStats.total = Math.round(increments.total * currentStep);
        this.displayStats.finalizada = Math.round(increments.finalizada * currentStep);
        this.displayStats.emAndamento = Math.round(increments.emAndamento * currentStep);
        this.displayStats.agendada = Math.round(increments.agendada * currentStep);
        this.displayStats.desconhecido = Math.round(increments.desconhecido * currentStep);
      }
    }, intervalTime);
  }
}
