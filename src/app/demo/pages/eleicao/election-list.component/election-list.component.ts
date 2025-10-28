// src/app/admin/eleicao-list/eleicao-list.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Para o routerLink
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { AuthService } from '../../../../services/auth.service';
import { Eleicao } from '../../../../models/Eleicao';
import { Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-eleicao-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './election-list.component.html',
  styleUrls: ['./election-list.component.scss']
})
export class EleicaoListComponent implements OnInit {

  private eleicaoAdminService = inject(EleicaoAdminService);
  private authService = inject(AuthService);

  public eleicoes$!: Observable<Eleicao[]>;
  public isLoading = true;
  public error: string | null = null;

  ngOnInit(): void {
    const adminUid = this.authService.getCurrentUserUid();

    if (!adminUid) {
      this.error = "Não foi possível identificar o usuário. Faça login novamente.";
      this.isLoading = false;
      this.eleicoes$ = of([]);
      return;
    }

    this.eleicoes$ = this.eleicaoAdminService.getEleicoesDoAdmin(adminUid).pipe(
      tap(() => this.isLoading = false),
      catchError(err => {
        this.error = "Erro ao carregar eleições.";
        this.isLoading = false;
        return of([]);
      })
    );
  }
}
