import { Component, inject, signal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { AuthService } from '../../../../services/auth.service';
import { Eleicao } from '../../../../models/Eleicao';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-eleicao-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './election-list.component.html',
  styleUrls: ['./election-list.component.scss'],
})
export class EleicaoListComponent {
  private eleicaoAdminService = inject(EleicaoAdminService);
  private authService = inject(AuthService);

  public isLoading = signal(true);
  public error = signal<string | null>(null);


  public pageSize = signal(4);
  public pageIndex = signal(0);

  public allEleicoes: Signal<Eleicao[]>;

  public paginatedEleicoes: Signal<Eleicao[]>;


  constructor() {
    const adminUid = this.authService.getCurrentUserUid();

    if (!adminUid) {
      this.error.set(
        'Não foi possível identificar o usuário. Faça login novamente.'
      );
      this.isLoading.set(false);
      this.allEleicoes = signal([]); // Define como vazio se houver erro
    } else {
      const eleicoes$ = this.eleicaoAdminService.getEleicoesDoAdmin(adminUid).pipe(
        tap(() => this.isLoading.set(false)),
        catchError((err) => {
          this.error.set('Erro ao carregar eleições.');
          this.isLoading.set(false);
          return of([]);
        })
      );
      this.allEleicoes = toSignal(eleicoes$, { initialValue: [] });
    }

    this.paginatedEleicoes = computed(() => {
      const eleicoes = this.allEleicoes();
      const start = this.pageIndex() * this.pageSize();
      const end = start + this.pageSize();
      return eleicoes.slice(start, end);
    });
  }

  /**
   * Chamado quando o usuário muda de página ou altera o tamanho da página.
   */
  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
