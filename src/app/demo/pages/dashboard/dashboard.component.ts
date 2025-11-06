import { Component, OnInit, inject, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/shared/shared.module';
import { EleicaoAdminService } from '../../../services/eleicao-admin.service';
import { AuthService } from '../../../services/auth.service';
import { Eleicao } from '../../../models/Eleicao';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

interface KpiCard {
  titulo: string;
  valor: number;
  icon: string;
  cor: 'primary' | 'accent' | 'warn' | 'default';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    MatCardModule,
    MatListModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private eleicaoAdminService = inject(EleicaoAdminService);
  private router = inject(Router);

  public eleicoes: Signal<Eleicao[]>;

  public eleicoesAtivas: Signal<Eleicao[]>;
  public eleicoesConcluidas: Signal<Eleicao[]>;

  public kpiCards: Signal<KpiCard[]>;

  constructor() {
    const adminUid = this.authService.getCurrentUserUid();
    if (!adminUid) {
      console.error('Admin não autenticado, dashboard não pode carregar dados.');
      this.eleicoes = computed(() => []);
    } else {
      this.eleicoes = toSignal(
        this.eleicaoAdminService.getEleicoesDoAdmin(adminUid),
        { initialValue: [] }
      );
    }

    this.eleicoesAtivas = computed(() =>
      this.eleicoes().filter(
        (e) => e.status === 'agendada' || e.status === 'em_andamento'
      )
    );

    this.eleicoesConcluidas = computed(() =>
      this.eleicoes().filter((e) => e.status === 'finalizada')
    );

    this.kpiCards = computed(() => [
      {
        titulo: 'Total de Eleições',
        valor: this.eleicoes().length,
        icon: 'ballot',
        cor: 'primary',
      },
      {
        titulo: 'Agendadas',
        valor: this.eleicoes().filter((e) => e.status === 'agendada').length,
        icon: 'event',
        cor: 'default',
      },
      {
        titulo: 'Em Andamento',
        valor: this.eleicoes().filter((e) => e.status === 'em_andamento')
          .length,
        icon: 'hourglass_top',
        cor: 'accent',
      },
      {
        titulo: 'Concluídas',
        valor: this.eleicoesConcluidas().length,
        icon: 'check_circle',
        cor: 'default',
      },
    ]);
  }

  ngOnInit(): void {
  }

  irParaCriarEleicao() {
    this.router.navigate(['/eleicoes/registrar']);
  }

  irParaListaEleicoes() {
    this.router.navigate(['/eleicoes/lista']);
  }

  irParaDetalhes(eleicaoId: string) {
    this.router.navigate(['eleicoes/gerenciar', eleicaoId]);
  }
}
