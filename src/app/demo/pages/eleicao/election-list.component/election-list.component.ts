import { Component, inject, signal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { EleicaoOficialService } from '../../../../services/eleicao-oficial.service';
import { EleicaoPastoralService } from '../../../../services/eleicao-pastoral.service';
import { AuthService } from '../../../../services/auth.service';
import { combineLatest, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

export interface UnifiedEleicao {
  id: string;
  titulo: string;
  status: 'agendada' | 'em_andamento' | 'finalizada';
  cargosCount: number;
  membrosCount: number;
  isOficial: boolean;
  isPastoral: boolean;
  tipoRotulo: 'Diretoria' | 'Oficiais' | 'Pastores';
  manageRoute: string[];
  editRoute: string[];
}

@Component({
  selector: 'app-eleicao-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './election-list.component.html',
  styleUrls: ['./election-list.component.scss'],
})
export class EleicaoListComponent {
  private eleicaoAdminService = inject(EleicaoAdminService);
  private eleicaoOficialService = inject(EleicaoOficialService);
  private eleicaoPastoralService = inject(EleicaoPastoralService);
  private authService = inject(AuthService);

  public isLoading = signal(true);
  public error = signal<string | null>(null);

  public pageSize = signal(6);
  public pageIndex = signal(0);

  public allEleicoes: Signal<UnifiedEleicao[]>;
  public paginatedEleicoes: Signal<UnifiedEleicao[]>;

  constructor() {
    const adminUid = this.authService.getCurrentUserUid();

    if (!adminUid) {
      this.error.set('Não foi possível identificar o usuário. Faça login novamente.');
      this.isLoading.set(false);
      this.allEleicoes = signal([]);
    } else {
      const diretoria$ = this.eleicaoAdminService.getEleicoesDoAdmin(adminUid).pipe(
        map((list) =>
          list.map((e) => ({
            id: e.id,
            titulo: e.titulo,
            status: e.status,
            cargosCount: e.cargos ? e.cargos.length : 0,
            membrosCount: e.membrosElegiveis ? e.membrosElegiveis.length : 0,
            isOficial: false,
            isPastoral: false,
            tipoRotulo: 'Diretoria' as const,
            manageRoute: ['/eleicoes/gerenciar', e.id],
            editRoute: ['/eleicoes/editar', e.id]
          }))
        ),
        catchError(() => of([]))
      );

      const oficiais$ = this.eleicaoOficialService.getEleicoesOficiaisDoAdmin(adminUid).pipe(
        map((list) =>
          list.map((e) => ({
            id: e.id,
            titulo: e.titulo,
            status: e.status,
            cargosCount: e.cargos ? e.cargos.length : 0,
            membrosCount: e.membrosElegiveis ? e.membrosElegiveis.length : 0,
            isOficial: true,
            isPastoral: false,
            tipoRotulo: 'Oficiais' as const,
            manageRoute: ['/eleicoes/oficiais/gerenciar', e.id],
            editRoute: ['/eleicoes/oficiais/editar', e.id]
          }))
        ),
        catchError(() => of([]))
      );

      const pastorais$ = this.eleicaoPastoralService.getEleicoesPastoraisDoAdmin(adminUid).pipe(
        map((list) =>
          list.map((e) => ({
            id: e.id,
            titulo: e.titulo,
            status: e.status,
            cargosCount: e.cargos ? e.cargos.length : 0,
            membrosCount: e.membrosElegiveis ? e.membrosElegiveis.length : 0,
            isOficial: false,
            isPastoral: true,
            tipoRotulo: 'Pastores' as const,
            manageRoute: ['/eleicoes/pastores/gerenciar', e.id],
            editRoute: ['/eleicoes/pastores/editar', e.id]
          }))
        ),
        catchError(() => of([]))
      );

      const todas$ = combineLatest([diretoria$, oficiais$, pastorais$]).pipe(
        map(([d, o, p]) => [...d, ...o, ...p]),
        tap(() => this.isLoading.set(false)),
        catchError((err) => {
          console.error('Erro ao carregar lista unificada de eleições:', err);
          this.error.set('Erro ao carregar lista de eleições.');
          this.isLoading.set(false);
          return of([]);
        })
      );

      this.allEleicoes = toSignal(todas$, { initialValue: [] });
    }

    this.paginatedEleicoes = computed(() => {
      const eleicoes = this.allEleicoes();
      const start = this.pageIndex() * this.pageSize();
      const end = start + this.pageSize();
      return eleicoes.slice(start, end);
    });
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
