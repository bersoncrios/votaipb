import { Component, OnInit, inject, computed, Signal, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/shared/shared.module';
import { EleicaoAdminService } from '../../../services/eleicao-admin.service';
import { AuthService } from '../../../services/auth.service';
import { Eleicao } from '../../../models/Eleicao';

// Material & Icons
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { IconsModule } from 'src/app/shared/icons.module';

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
    MatListModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    IconsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private eleicaoAdminService = inject(EleicaoAdminService);
  private router = inject(Router);

  public eleicoes: Signal<Eleicao[]>;
  public eleicoesAtivas: Signal<Eleicao[]>;
  public eleicoesConcluidas: Signal<Eleicao[]>;
  public kpiCards: Signal<KpiCard[]>;

  // Table Data Sources
  dataSourceAtivas = new MatTableDataSource<Eleicao>([]);
  dataSourceConcluidas = new MatTableDataSource<Eleicao>([]);
  displayedColumns: string[] = ['status', 'titulo', 'acoes'];

  @ViewChild('paginatorAtivas') paginatorAtivas!: MatPaginator;
  @ViewChild('paginatorConcluidas') paginatorConcluidas!: MatPaginator;

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

    this.eleicoesAtivas = computed(() => {
      const ativas = this.eleicoes().filter(
        (e) => e.status === 'agendada' || e.status === 'em_andamento'
      );
      this.dataSourceAtivas.data = ativas;
      return ativas;
    });

    this.eleicoesConcluidas = computed(() => {
      const concluidas = this.eleicoes().filter((e) => e.status === 'finalizada');
      this.dataSourceConcluidas.data = concluidas;
      return concluidas;
    });

    this.kpiCards = computed(() => [
      {
        titulo: 'Total de Eleições',
        valor: this.eleicoes().length,
        icon: 'chart-bar',
        cor: 'primary',
      },
      {
        titulo: 'Agendadas',
        valor: this.eleicoes().filter((e) => e.status === 'agendada').length,
        icon: 'calendar-event',
        cor: 'default',
      },
      {
        titulo: 'Em Andamento',
        valor: this.eleicoes().filter((e) => e.status === 'em_andamento').length,
        icon: 'hourglass-high',
        cor: 'accent',
      },
      {
        titulo: 'Concluídas',
        valor: this.eleicoesConcluidas().length,
        icon: 'circle-check',
        cor: 'default',
      },
    ]);
  }

  ngOnInit(): void { }

  // Configura paginadores após a view iniciar
  ngAfterViewInit() {
    this.dataSourceAtivas.paginator = this.paginatorAtivas;
    this.dataSourceConcluidas.paginator = this.paginatorConcluidas;
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
