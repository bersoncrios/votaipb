// src/app/votacao/votacao.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VotacaoService, CedulaAberta } from '../../../../services/votacao.service'; // Ajuste o caminho
import { Membro } from '../../../../models/Membro'; // Ajuste o caminho
import { Candidato } from '../../../../models/Candidato'; // Ajuste o caminho
import { Observable, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

// Para o formulário de identificação (Passo 1)
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

type VotacaoStep = 'carregando' | 'identificacao' | 'votacao' | 'confirmacao' | 'concluido' | 'erro';

@Component({
  selector: 'app-votacao',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule // Necessário para o formulário de ID
  ],
  templateUrl: './votacao.component.html',
  styleUrls: ['./votacao.component.scss']
})
export class VotacaoComponent implements OnInit {

  // Injeção de dependências
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private votacaoService = inject(VotacaoService);

  // Estado do Wizard
  public step: VotacaoStep = 'carregando';

  // Formulário de Identificação
  public idForm = this.fb.group({
    eleitorId: ['', Validators.required]
  });

  // Dados da Votação
  public eleicaoId!: string;
  public cedula$!: Observable<CedulaAberta | null>;
  public cedulaAberta!: CedulaAberta; // Armazena os dados da cédula após o carregamento
  public membroValidado!: Membro;

  // Voto
  public votoSelecionado: { id: string, nome: string } | null = null;

  // Mensagens de Erro
  public errorMessage: string | null = null;

  ngOnInit(): void {
    // 1. Pega o ID da eleição da URL e busca a cédula aberta
    this.cedula$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          this.handleError('Link de votação inválido (sem ID).');
          return of(null);
        }
        this.eleicaoId = id;
        return this.votacaoService.getCedulaAberta(id); // Busca a cédula
      }),
      tap(cedula => {
        if (cedula) {
          // 2. Cédula encontrada! Guarda os dados e avança para identificação
          this.cedulaAberta = cedula;
          this.step = 'identificacao';
        } else {
          // 3. Nenhuma cédula aberta (eleição fechada, agendada ou ID errado)
          this.handleError('Nenhuma votação aberta no momento.');
        }
      }),
      catchError(err => {
        this.handleError(err.message);
        return of(null);
      })
    );
  }

  /**
   * PASSO 1: O votante submete seu ID de membro
   */
  async onValidarEleitor() {
    if (this.idForm.invalid) {
      return;
    }
    this.step = 'carregando'; // Mostra "carregando"
    const { eleitorId } = this.idForm.value;

    try {
      // Usa o service para validar
      const validacao = this.votacaoService.validarVotante(
        this.cedulaAberta,
        eleitorId!
      );

      if (validacao.valido) {
        this.membroValidado = validacao.membro!;
        this.step = 'votacao'; // Sucesso! Avança para a cédula
      } else {
        this.handleError(validacao.mensagem, 'identificacao'); // Mostra erro e volta p/ ID
      }
    } catch (e: any) {
      this.handleError(e.message, 'identificacao');
    }
  }

  /**
   * PASSO 2: O votante seleciona um candidato (ou branco/nulo)
   */
  onSelecionarVoto(candidato: Candidato | 'BRANCO' | 'NULO') {
    if (candidato === 'BRANCO') {
      this.votoSelecionado = { id: 'BRANCO', nome: 'Voto em Branco' };
    } else if (candidato === 'NULO') {
      this.votoSelecionado = { id: 'NULO', nome: 'Voto Nulo' };
    } else {
      this.votoSelecionado = { id: candidato.userId, nome: candidato.nome };
    }
    this.step = 'confirmacao'; // Avança para confirmação
  }

  /**
   * PASSO 3: O votante confirma o voto
   */
  async onConfirmarVoto() {
    if (!this.votoSelecionado) return;

    this.step = 'carregando'; // Mostra "carregando"

    try {
      await this.votacaoService.registrarVoto(
        this.eleicaoId,
        this.cedulaAberta.cargo.id,
        this.cedulaAberta.escrutinio.numero,
        this.membroValidado.id,
        this.votoSelecionado.id
      );
      this.step = 'concluido'; // SUCESSO!

    } catch (e: any) {
      // O erro mais comum aqui é "Seu voto já foi registrado" (double-click)
      // ou "O escrutínio foi fechado" (admin fechou durante a votação)
      this.handleError(e.message);
    }
  }

  // Volta para a etapa de votação (botão "Corrigir")
  corrigirVoto() {
    this.votoSelecionado = null;
    this.step = 'votacao';
  }

  // Helpers
  private handleError(message: string, returnStep: VotacaoStep = 'erro') {
    this.errorMessage = message;
    this.step = returnStep;
    console.error(message);
  }
}
