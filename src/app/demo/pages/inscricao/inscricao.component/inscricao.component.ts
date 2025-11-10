import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ListaInscricaoService } from '../../../../services/lista-inscricao.service';
import { ListaInscricao } from '../../../../models/Inscricao';
// Importe os módulos do Material individualmente ou o seu SharedModule
// import { SharedModule } from 'src/app/shared/shared.module';

type Steps = 'loading' | 'form' | 'success' | 'error' | 'closed';

@Component({
  selector: 'app-inscricao',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule
    // SharedModule // Descomente se usar
  ],
  templateUrl: './inscricao.component.html',
  styleUrls: ['./inscricao.component.scss']
})
export class InscricaoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private listaService = inject(ListaInscricaoService);

  public step: Steps = 'loading';
  public listaId: string | null = null;
  public listaDados: ListaInscricao | null = null;
  public errorMessage = '';

  public form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    userId: ['', [Validators.required, Validators.minLength(2)]]
  });

  ngOnInit() {
    // Usa 'subscribe' em vez de 'snapshot' para ser reativo
    this.route.paramMap.subscribe(params => {
      this.listaId = params.get('id');
      if (this.listaId) {
        this.carregarDadosLista(this.listaId);
      } else {
        this.mostrarErro('Link de inscrição inválido.');
      }
    });
  }

  carregarDadosLista(id: string) {
    this.step = 'loading';
    this.listaService.getListaPublica(id).subscribe({
      next: (lista) => {
        if (!lista) {
          this.mostrarErro('Lista de inscrição não encontrada.');
        } else if (!lista.ativa) {
          this.step = 'closed';
          this.listaDados = lista;
        } else {
          this.listaDados = lista;
          this.step = 'form';
        }
      },
      error: (err) => {
        console.error('Erro ao carregar lista:', err);
        this.mostrarErro('Erro ao carregar a lista. Tente recarregar a página.');
      }
    });
  }

  async onSubmit() {
    if (this.form.invalid || !this.listaId) {
      this.form.markAllAsTouched(); // Força a exibição dos erros de validação
      return;
    }

    this.step = 'loading';
    const { nome, userId } = this.form.value;

    try {
      await this.listaService.registrarNaLista(this.listaId, nome!, userId!);
      this.step = 'success';
    } catch (e: any) {
      if (e.message === 'ID_DUPLICADO') {
        this.step = 'form';
        // Define um erro específico no campo userId
        this.form.get('userId')?.setErrors({ duplicado: true });
        this.form.get('userId')?.markAsTouched();
      } else if (e.message === 'LISTA_FECHADA') {
        this.step = 'closed';
      } else {
        console.error('Erro no registo:', e);
        this.mostrarErro('Ocorreu um erro inesperado. Tente novamente.');
      }
    }
  }

  private mostrarErro(msg: string) {
    this.step = 'error';
    this.errorMessage = msg;
  }
}
