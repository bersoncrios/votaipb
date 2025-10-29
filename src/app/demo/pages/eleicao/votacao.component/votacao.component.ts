import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VotacaoService, CedulaAberta } from '../../../../services/votacao.service'; // Ajuste o caminho
import { Membro } from '../../../../models/Membro'; // Ajuste o caminho
import { Candidato } from '../../../../models/Candidato'; // Ajuste o caminho
import { from, Observable, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { SharedModule } from "src/app/shared/shared.module";

type VotacaoStep = 'carregando' | 'identificacao' | 'votacao' | 'confirmacao' | 'concluido' | 'naoIniciado' | 'erro';

@Component({
  selector: 'app-votacao',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule // Necessário para o formulário de ID
    ,
    MatProgressSpinner,
    SharedModule
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
    this.carregarCedula();
  }

  // Separado para permitir recarregamento manual, se necessário
  carregarCedula(): void {
    this.step = 'carregando'; // Garante o estado inicial ao carregar/recarregar
    this.errorMessage = null; // Limpa erros anteriores

    this.cedula$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          // Usa um erro específico para link inválido
          throw new Error('LINK_INVALIDO');
        }
        this.eleicaoId = id;
        // Retorna a Promise como Observable para compatibilidade com o pipe
        return from(this.votacaoService.getCedulaAberta(id));
      }),
      tap(cedula => {
        if (cedula) {
          // Cédula encontrada! Guarda os dados e avança para identificação
          this.cedulaAberta = cedula;
          this.step = 'identificacao';
        } else {
          // Cédula é NULL, mas não houve erro na busca. Significa que a eleição existe
          // mas o escrutínio não está aberto.
          this.handleError('Esta votação ainda não foi iniciada pelo administrador.', 'naoIniciado');
        }
      }),
      catchError(err => {
        // Trata erros específicos lançados pelo serviço ou pelo switchMap
        if (err.message === 'LINK_INVALIDO') {
          this.handleError('Link de votação inválido.');
        } else if (err.message === 'ELEICAO_NAO_ENCONTRADA') { // Supondo que o serviço lance este erro
           this.handleError('Votação não encontrada ou link inválido.');
        } else {
          // Erro genérico (problema de rede, permissão, etc.)
          this.handleError('Ocorreu um erro ao carregar a votação. Tente novamente.');
        }
        return of(null); // Retorna um observable nulo para completar o pipe
      })
    );
  }

  /**
   * PASSO 1: O votante submete seu ID de membro
   */
  async onValidarEleitor() {
    if (this.idForm.invalid) {
       this.idForm.markAllAsTouched(); // Mostra os erros se o campo estiver vazio
      return;
    }
    this.step = 'carregando'; // Mostra "carregando"
    const { eleitorId } = this.idForm.value;

    try {
      // Usa o service para validar
      const validacao = this.votacaoService.validarVotante(
        this.cedulaAberta,
        eleitorId! // Usa o non-null assertion pois o form é inválido se for nulo
      );

      if (validacao.valido) {
        this.membroValidado = validacao.membro!;
        this.step = 'votacao'; // Sucesso! Avança para a cédula
        this.errorMessage = null; // Limpa qualquer erro anterior
      } else {
        this.handleError(validacao.mensagem, 'identificacao'); // Mostra erro e volta p/ ID
      }
    } catch (e: any) {
      this.handleError(e.message || 'Erro ao validar eleitor.', 'identificacao');
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
      // Garante que 'candidato' é do tipo Candidato aqui
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
        this.membroValidado.id, // ID do membro validado
        this.votoSelecionado.id // ID do voto (userId do candidato, BRANCO ou NULO)
      );
      this.step = 'concluido'; // SUCESSO!

    } catch (e: any) {
      // Trata erros comuns do lado do serviço
      this.handleError(e.message || 'Erro ao registrar o voto.');
    }
  }

  /**
   * Volta para a etapa de votação (botão "Corrigir")
   */
  corrigirVoto() {
    this.votoSelecionado = null;
    this.step = 'votacao';
  }

  /**
   * Helper para centralizar o tratamento de erros e mudança de estado.
   * @param message Mensagem de erro a ser exibida.
   * @param returnStep Estado para o qual o wizard deve ir (padrão 'erro').
   */
  private handleError(message: string, returnStep: VotacaoStep = 'erro') {
    this.errorMessage = message;
    this.step = returnStep;
    console.error(`Erro na Votação: ${message}`); // Log para debugging
  }
}
