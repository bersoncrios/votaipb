import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { Eleicao } from '../../../../models/Eleicao';
import { Cargo, CargoStatus } from '../../../../models/Cargo';
import { Escrutinio } from '../../../../models/Escritineo';
import { Candidato } from '../../../../models/Candidato';

import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators'; // Importe o 'map'
import { CommonModule } from '@angular/common';
import { cloneDeep } from 'lodash-es';
import Swal from 'sweetalert2';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ApuracaoResultado = {
  votosPorCandidato: Map<string, number>;
  totalBrancos: number;
  totalNulos: number;
};

type ApuracaoOrdenadaItem = {
  userId: string;
  nome: string;
  votos: number;
};

@Component({
  selector: 'app-eleicao-manage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './election-manager.component.html',
  styleUrls: ['./election-manager.component.scss']
})
export class EleicaoManageComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private eleicaoAdminService = inject(EleicaoAdminService);

  public eleicao$!: Observable<Eleicao>;
  public apuracaoCache = new Map<string, ApuracaoResultado>();
  public apuracaoOrdenadaCache = new Map<string, ApuracaoOrdenadaItem[]>();

  public resultadosExpandidos = new Set<string>();

  ngOnInit(): void {
    this.eleicao$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          throw new Error('ID da eleição não fornecido');
        }
        return this.eleicaoAdminService.getEleicaoObservable(id);
      }),
      map(eleicao => this.normalizarEleicao(eleicao))
    );
  }


  private normalizarEleicao(eleicao: Eleicao): Eleicao {
    if (!eleicao) return eleicao;

    const cargosNormalizados = (eleicao.cargos || []).map(cargo => {
      const vencedor = cargo.vencedor === undefined ? null : cargo.vencedor;

      const candidatosEmpatados = (cargo as any).candidatosEmpatados || null;

      const status: CargoStatus = cargo.status || (vencedor ? 'finalizado' : 'aguardando');

      return {
        ...cargo,
        status,
        vencedor,
        candidatosEmpatados
      };
    });

    return {
      ...eleicao,
      cargos: cargosNormalizados
    };
  }

  toggleResultados(cargoId: string): void {
    if (this.resultadosExpandidos.has(cargoId)) {
      this.resultadosExpandidos.delete(cargoId);
    } else {
      this.resultadosExpandidos.add(cargoId);
    }
  }

  isResultadosExpandidos(cargoId: string): boolean {
    return this.resultadosExpandidos.has(cargoId);
  }

  podeAbrirEscrutinio(eleicao: Eleicao, cargo: Cargo, escrutinio: Escrutinio): boolean {
    if (eleicao.cargoAbertoParaVotacao) return false;
    if (escrutinio.candidatos.length === 0) return false;

    if (escrutinio.numero > 1) {
      const anterior = cargo.escrutinios.find(e => e.numero === escrutinio.numero - 1);
      if (!anterior || anterior.status !== 'fechado') return false;
    }

    return true;
  }


  /**
   * Lógica para abrir um escrutínio
   */
  async onAbrirEscrutinio(eleicao: Eleicao, cargo: Cargo, escrutinio: Escrutinio) {
    if (eleicao.cargoAbertoParaVotacao) {
      console.log('Bloqueio de abertura: ', eleicao.cargoAbertoParaVotacao);
      Swal.fire(
        'Atenção',
        `Já existe um escrutínio aberto (Cargo: ${eleicao.cargoAbertoParaVotacao.cargoId}, Escrutínio: ${eleicao.cargoAbertoParaVotacao.escrutinioNum}). Feche-o antes de abrir outro.`,
        'warning'
      );
      return;
    }
    const novosCargos = cloneDeep(eleicao.cargos);

    const cargoAtual = novosCargos.find(c => c.id === cargo.id);
    if (!cargoAtual) return;

    const escrutinioAtual = cargoAtual.escrutinios.find(e => e.numero === escrutinio.numero);

    if (escrutinioAtual) {
      escrutinioAtual.status = 'aberto';
      cargoAtual.status = 'em_votacao';
    } else {
      console.error('Falha ao encontrar escrutínio para abrir.');
      return;
    }

    try {
      const updates: Partial<Eleicao> = {
        cargos: novosCargos,
        status: 'em_andamento',
        cargoAbertoParaVotacao: {
          cargoId: cargo.id,
          escrutinioNum: escrutinio.numero
        }
      };

      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);
      Swal.fire('Sucesso!', `Escrutínio ${escrutinio.numero} para ${cargo.titulo} aberto!`, 'success');
    } catch (e) {
      console.error('Erro ao abrir escrutínio:', e);
    }
  }

  /**
   * Lógica para fechar um escrutínio (com regras de negócio)
   */
  async onFecharEscrutinio(eleicao: Eleicao, cargo: Cargo, escrutinio: Escrutinio) {
    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;
    const escrutinioAtual = cargoAtual.escrutinios.find(e => e.numero === escrutinio.numero)!;

    escrutinioAtual.status = 'fechado';

    const { apuracao, totalVotosValidos } = this._apurarVotos(escrutinioAtual);

    const cacheKey = `${cargo.id}-${escrutinio.numero}`;
    this.apuracaoCache.set(cacheKey, apuracao);
    const apuracaoOrdenada: ApuracaoOrdenadaItem[] =
      Array.from(apuracao.votosPorCandidato.entries())
        .map(([userId, votos]) => ({
          userId: userId,
          nome: this.getCandidatoNome(cargo, userId),
          votos: votos
        }))
        .sort((a, b) => b.votos - a.votos);
    this.apuracaoOrdenadaCache.set(cacheKey, apuracaoOrdenada);

    let vencedorEncontrado: Candidato | undefined = undefined;

    if (escrutinio.numero === 1 || escrutinio.numero === 2) {
      if (totalVotosValidos > 0) {
        const [vencedorId, _votosVencedor] =
          [...apuracao.votosPorCandidato.entries()]
            .find(([id, contagem]) => contagem > (totalVotosValidos / 2)) || [];

        if (vencedorId) {
          vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
        }
      }
    }
    else if (escrutinio.numero >= 3) {
      if (totalVotosValidos > 0 && apuracaoOrdenada.length > 0) {

        const maxVotos = apuracaoOrdenada[0].votos;
        const empatados = apuracaoOrdenada.filter(c => c.votos === maxVotos && c.votos > 0);

        if (empatados.length === 1) {
          const vencedorId = empatados[0].userId;
          vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
        } else if (empatados.length > 1) {
          console.log(`Empate no ${escrutinio.numero}º escrutínio detectado.`);

          // Pergunta ao admin o que fazer
          const { value: decisao } = await Swal.fire({
            title: 'Empate Detectado!',
            html: `Houve um empate no ${escrutinio.numero}º escrutínio entre <b>${empatados.length} candidatos</b>.<br>O que deseja fazer?`,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Voto de Minerva',
            denyButtonText: `Abrir ${escrutinio.numero + 1}º Escrutínio`,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            denyButtonColor: '#d33'
          });

          if (decisao === true) {
            // Voto de Minerva (Comportamento Antigo)
            cargoAtual.status = 'pendente_desempate';
            const idsEmpatados = empatados.map(e => e.userId);
            const candidatosEmpatados = cargo.candidatosIniciais.filter(c => idsEmpatados.includes(c.userId));
            (cargoAtual as any).candidatosEmpatados = candidatosEmpatados;

            Swal.fire(
              'Empate!',
              `Modo de desempate manual ativado.<br>Selecione o vencedor manualmente.`,
              'warning'
            );

          } else if (decisao === false) {
            // Abrir Novo Escrutínio
            const idsEmpatados = empatados.map(e => e.userId);
            const candidatosEmpatados = cargo.candidatosIniciais.filter(c => idsEmpatados.includes(c.userId));

            try {
              await this.eleicaoAdminService.prepararProximoEscrutinio(
                eleicao.id,
                cargo.id,
                escrutinio.numero + 1,
                candidatosEmpatados
              );

              // Atualiza localmente para refletir a mudança sem reload se possível, 
              // mas o update do service deve disparar o observable.
              // Vamos apenas notificar.
              Swal.fire('Sucesso', `${escrutinio.numero + 1}º Escrutínio preparado com os candidatos empatados.`, 'success');
              return; // Sai da função pois o status do cargo mudou para aguardando no service
            } catch (e) {
              Swal.fire('Erro', `Erro ao criar novo escrutínio: ${e}`, 'error');
              return;
            }
          } else {
            // Cancelou
            return;
          }
        }
      }
    }

    const updates: Partial<Eleicao> = {
      cargoAbertoParaVotacao: null
    };

    if (vencedorEncontrado) {
      cargoAtual.vencedor = vencedorEncontrado;
      cargoAtual.status = 'pendente_confirmacao';
      Swal.fire(
        'Vencedor Encontrado!',
        `Vencedor para ${cargo.titulo}: ${vencedorEncontrado.nome}.<br>Aguardando confirmação de aceite.`,
        'info'
      );
    }
    else if (cargoAtual.status === 'pendente_desempate') {
      // Já tratado no Swal acima, mas mantemos para consistência se cair aqui
    }
    else {
      if (escrutinio.numero < 3) {
        cargoAtual.status = 'aguardando';
        Swal.fire('Escrutínio Fechado', `Escrutínio ${escrutinio.numero} fechado. Nenhum candidato atingiu mais de 50%. Prossiga para o próximo escrutínio.`, 'info');
      } else if (escrutinio.numero >= 3 && !vencedorEncontrado) {
        // Se chegou aqui e é >= 3 e não tem vencedor e não é desempate, 
        // significa que não houve empate (todos 0 votos?) ou algo atípico.
        // Ou simplesmente fechou sem vencedor definido (ex: todos 0).
        cargoAtual.vencedor = null;
        cargoAtual.status = 'finalizado';
        Swal.fire('Escrutínio Fechado', `Escrutínio ${escrutinio.numero} fechado. Nenhum vencedor definido.`, 'info');
      }
    }

    updates.cargos = novosCargos;

    if (cargoAtual.status === 'finalizado') {
      const todosCargosFinalizados = novosCargos.every(c => c.status === 'finalizado');
      if (todosCargosFinalizados) {
        updates.status = 'finalizada';
        Swal.fire('Eleição Encerrada!', `Todos os cargos foram preenchidos ou finalizados. A eleição "${eleicao.titulo}" foi encerrada.`, 'success');
      }
    }

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);
    } catch (e) {
      console.error('Erro ao fechar escrutínio:', e);
      Swal.fire('Erro!', `Ocorreu um erro ao fechar o escrutínio: ${e}`, 'error');
    }
  }

  /**
   * Chamado quando o admin confirma que o vencedor aceitou o cargo.
   */
  async onConfirmarAceite(eleicao: Eleicao, cargo: Cargo) {
    if (!cargo.vencedor) {
      Swal.fire('Erro', 'Este cargo não possui um vencedor para confirmar.', 'error');
      return;
    }

    const { value: confirmou } = await Swal.fire({
      title: 'Confirmar Aceite',
      text: `Você confirma que ${cargo.vencedor.nome} ACEITOU o cargo de ${cargo.titulo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, aceitou!',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmou) return;

    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;

    cargoAtual.status = 'finalizado';

    const updates: Partial<Eleicao> = {
      cargos: novosCargos
    };

    const todosCargosFinalizados = novosCargos.every(c => c.status === 'finalizado');
    if (todosCargosFinalizados) {
      updates.status = 'finalizada';
      Swal.fire('Eleição Encerrada!', `Todos os cargos foram finalizados. A eleição "${eleicao.titulo}" foi encerrada.`, 'success');
    } else {
      Swal.fire('Cargo Finalizado!', `Vencedor ${cargo.vencedor.nome} confirmado para ${cargo.titulo}.`, 'success');
    }

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);

      console.log(`Chamando service para remover ${cargo.vencedor.userId} de outros cargos...`);
      await this.eleicaoAdminService.removerCandidatosEleitosDeOutrosCargos(
        eleicao.id,
        [cargo.vencedor.userId],
        cargo.id
      );

    } catch (e) {
      console.error('Erro ao confirmar aceite ou remover candidato:', e);
      Swal.fire('Erro!', `Ocorreu um erro: ${e}`, 'error');
    }
  }

  /**
   * Chamado quando o admin informa que o vencedor DECLINOU o cargo.
   */
  async onDeclinar(eleicao: Eleicao, cargo: Cargo) {
    if (!cargo.vencedor) {
      Swal.fire('Erro', 'Este cargo não possui um vencedor para declinar.', 'error');
      return;
    }

    const { value: confirmou } = await Swal.fire({
      title: 'Confirmar Declínio',
      text: `Você confirma que ${cargo.vencedor.nome} DECLINOU do cargo de ${cargo.titulo}? Isso irá REINICIAR a votação para este cargo.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, declinou (Reiniciar)',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33'
    });

    if (!confirmou) return;

    try {
      await this.eleicaoAdminService.reiniciarCargo(eleicao.id, cargo.id);

      Swal.fire(
        'Cargo Reiniciado!',
        `O vencedor declinou. A votação para ${cargo.titulo} foi reiniciada e voltará ao 1º escrutínio.`,
        'success'
      );
    } catch (e) {
      console.error('Erro ao reiniciar cargo:', e);
      Swal.fire('Erro!', `Ocorreu um erro ao reiniciar o cargo: ${e}`, 'error');
    }
  }

  /**
   * Lógica para definir um vencedor manualmente em caso de empate.
   */
  async onDesempatar(eleicao: Eleicao, cargo: Cargo, vencedor: Candidato) {
    const { value: confirmou } = await Swal.fire({
      title: 'Confirmar Voto de Minerva',
      text: `Você confirma que ${vencedor.nome} foi escolhido para desempatar e assumir o cargo de ${cargo.titulo}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, confirmar vencedor!',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmou) return;

    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;

    cargoAtual.vencedor = vencedor;
    cargoAtual.status = 'pendente_confirmacao';
    (cargoAtual as any).candidatosEmpatados = [];

    const updates: Partial<Eleicao> = {
      cargos: novosCargos
    };

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);
      Swal.fire(
        'Desempate Resolvido!',
        `Vencedor ${vencedor.nome} definido para ${cargo.titulo}.<br>Aguardando confirmação de aceite.`,
        'success'
      );
    } catch (e) {
      console.error('Erro ao resolver desempate:', e);
      Swal.fire('Erro!', `Ocorreu um erro: ${e}`, 'error');
    }
  }

  /**
   * Helper privado que APENAS conta os votos e retorna os resultados.
   */
  private _apurarVotos(escrutinio: Escrutinio): { apuracao: ApuracaoResultado, totalVotosValidos: number } {
    // ... (Sem alterações nesta função) ...
    const votos = escrutinio.votos || [];
    const resultados = new Map<string, number>();
    let totalBrancos = 0;
    let totalNulos = 0;

    for (const candidato of escrutinio.candidatos) {
      resultados.set(candidato.userId, 0);
    }

    for (const voto of votos) {
      if (voto.candidatoId === 'BRANCO') {
        totalBrancos++;
      } else if (voto.candidatoId === 'NULO') {
        totalNulos++;
      } else if (resultados.has(voto.candidatoId)) {
        resultados.set(voto.candidatoId, resultados.get(voto.candidatoId)! + 1);
      }
    }

    const totalVotosValidos = Array.from(resultados.values())
      .reduce((a, b) => a + b, 0);

    const apuracao = {
      votosPorCandidato: resultados,
      totalBrancos,
      totalNulos
    };

    return { apuracao, totalVotosValidos };
  }

  /**
   * Apura os votos e SALVA NO CACHE para exibição.
   */
  onApurar(cargo: Cargo, escrutinio: Escrutinio) {
    const { apuracao } = this._apurarVotos(escrutinio);

    const cacheKey = `${cargo.id}-${escrutinio.numero}`;
    this.apuracaoCache.set(cacheKey, apuracao);
    const apuracaoOrdenada: ApuracaoOrdenadaItem[] =
      Array.from(apuracao.votosPorCandidato.entries())
        .map(([userId, votos]) => ({
          userId: userId,
          nome: this.getCandidatoNome(cargo, userId),
          votos: votos
        }))
        .sort((a, b) => b.votos - a.votos);

    this.apuracaoOrdenadaCache.set(cacheKey, apuracaoOrdenada);
  }

  /**
   * Lógica (Regra de Negócio) para preparar o 3º Escrutínio
   */
  async onPreparar3Escrutinio(eleicao: Eleicao, cargo: Cargo) {
    const escrutinio2 = cargo.escrutinios.find(e => e.numero === 2);
    if (escrutinio2?.status !== 'fechado') {
      Swal.fire('Atenção', 'É preciso fechar o 2º Escrutínio antes de preparar o 3º.', 'warning');
      return;
    }

    const escrutinio3 = cargo.escrutinios.find(e => e.numero === 3);
    if (escrutinio3?.candidatos && escrutinio3.candidatos.length > 0) {
      Swal.fire('Atenção', 'O 3º Escrutínio já foi preparado e contém candidatos.', 'info');
      return;
    }

    try {
      await this.eleicaoAdminService.prepararTerceiroEscrutinio(eleicao.id, cargo.id);
      Swal.fire('Sucesso!', '3º Escrutínio preparado com sucesso. Os candidatos corretos (incluindo empates) foram definidos.', 'success');
    } catch (e) {
      console.error('Erro ao preparar 3º escrutínio:', e);
      Swal.fire('Erro!', `Ocorreu um erro ao preparar o escrutínio: ${e}`, 'error');
    }
  }

  /**
   * Copia o link público de votação
   */
  async onCopiarLink(eleicaoId: string) {
    // ... (Sem alterações nesta função) ...
    const origin = window.location.origin;
    const link = `${origin}/votar/${eleicaoId}`;

    try {
      await navigator.clipboard.writeText(link);
      Swal.fire({
        title: 'Link Copiado!',
        text: link,
        icon: 'success',
        footer: 'O link está na sua área de transferência.'
      });
    } catch (err) {
      console.error('Falha ao copiar link: ', err);
      Swal.fire({
        title: 'Falha ao Copiar',
        text: `Por favor, copie manually:\n\n${link}`,
        icon: 'error'
      });
    }
  }

  /**
   * Helper para buscar o nome de um candidato na lista inicial (completa)
   */
  getCandidatoNome(cargo: Cargo, userId: string): string {
    return cargo.candidatosIniciais.find(c => c.userId === userId)?.nome || 'Desconhecido';
  }

  /**
   * Força a re-apuração dos escrutínios 1 e 2 (para casos de bug)
   */
  async onForcarReapuracao(eleicao: Eleicao, cargo: Cargo) {
    Swal.fire('Iniciando...', 'Forçando re-apuração... Verificando 1º e 2º escrutínios.', 'info');

    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;

    if (cargoAtual.status === 'finalizado' || cargoAtual.status === 'pendente_confirmacao') {
      Swal.fire('Atenção', 'Este cargo já possui um vencedor ou está pendente de confirmação.', 'info');
      return;
    }

    let vencedorEncontrado: Candidato | undefined = undefined;

    const escrutinio1 = cargoAtual.escrutinios.find(e => e.numero === 1);
    if (escrutinio1 && escrutinio1.status === 'fechado') {
      const { apuracao, totalVotosValidos } = this._apurarVotos(escrutinio1);
      if (totalVotosValidos > 0) {
        const [vencedorId, _votos] =
          [...apuracao.votosPorCandidato.entries()]
            .find(([id, contagem]) => contagem > (totalVotosValidos / 2)) || [];
        if (vencedorId) {
          vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
        }
      }
    }

    const escrutinio2 = cargoAtual.escrutinios.find(e => e.numero === 2);
    if (!vencedorEncontrado && escrutinio2 && escrutinio2.status === 'fechado') {
      const { apuracao, totalVotosValidos } = this._apurarVotos(escrutinio2);
      if (totalVotosValidos > 0) {
        const [vencedorId, _votos] =
          [...apuracao.votosPorCandidato.entries()]
            .find(([id, contagem]) => contagem > (totalVotosValidos / 2)) || [];
        if (vencedorId) {
          vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
        }
      }
    }

    if (vencedorEncontrado) {
      cargoAtual.vencedor = vencedorEncontrado;
      cargoAtual.status = 'pendente_confirmacao';
      try {
        await this.eleicaoAdminService.updateEleicao(eleicao.id, { cargos: novosCargos });
        Swal.fire(
          'Sucesso!',
          `CORRIGIDO: Vencedor ${vencedorEncontrado.nome} foi definido para ${cargo.titulo}.<br>O cargo agora aguarda confirmação de aceite.`,
          'success'
        );
      } catch (e) {
        console.error('Erro ao forçar re-apuração:', e);
      }
    } else {
      Swal.fire('Concluído', 'Nenhum vencedor encontrado após re-apuração. A eleição continua para o 3º escrutínio.', 'info');
    }
  }

  /**
   * Gera um PDF com o relatório geral de TODOS os cargos.
   */
  async onGerarPdfGeral(eleicao: Eleicao) {
    // ... (Sem alterações nesta função) ...
    for (const cargo of eleicao.cargos) {
      for (const esc of cargo.escrutinios) {
        if (esc.status === 'fechado') {
          const cacheKey = `${cargo.id}-${esc.numero}`;
          if (!this.apuracaoOrdenadaCache.has(cacheKey) || !this.apuracaoCache.has(cacheKey)) {
            this.onApurar(cargo, esc);
          }
        }
      }
    }

    const doc = new jsPDF();
    const MARGEM_ESQUERDA = 14;
    let cursorY = 20;
    const PAGE_HEIGHT = doc.internal.pageSize.height;
    const BOTTOM_MARGIN = 30;

    doc.setFontSize(18);
    doc.text('Relatório Geral da Eleição', MARGEM_ESQUERDA, cursorY);
    cursorY += 10;
    doc.setFontSize(14);
    doc.text('Eleição Realizada via votaipb.com.br', MARGEM_ESQUERDA, cursorY);
    cursorY += 12;
    doc.setFontSize(14);
    doc.text(`Eleição: ${eleicao.titulo}`, MARGEM_ESQUERDA, cursorY);
    cursorY += 7;
    doc.text(`Status da Eleição: ${eleicao.status}`, MARGEM_ESQUERDA, cursorY);
    cursorY += 15;

    for (const cargo of eleicao.cargos) {

      if (cursorY > PAGE_HEIGHT - BOTTOM_MARGIN - 40) {
        this.adicionarRodape(doc, MARGEM_ESQUERDA);
        doc.addPage();
        cursorY = 20;
      }

      doc.setFontSize(16);
      doc.text(`Cargo: ${cargo.titulo}`, MARGEM_ESQUERDA, cursorY);
      cursorY += 8;

      doc.setFontSize(12);
      doc.text(`Status do Cargo: ${cargo.status}`, MARGEM_ESQUERDA, cursorY);
      cursorY += 7;

      const vencedorNome = cargo.vencedor?.nome || 'Nenhum vencedor definido';
      doc.setFont('helvetica', 'bold');
      doc.text(`Vencedor: ${vencedorNome}`, MARGEM_ESQUERDA, cursorY);
      doc.setFont('helvetica', 'normal');
      cursorY += 10;

      const escrutiniosFechados = cargo.escrutinios.filter(e => e.status === 'fechado');

      if (escrutiniosFechados.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum escrutínio finalizado para este cargo.', MARGEM_ESQUERDA, cursorY);
        doc.setFont('helvetica', 'normal');
        cursorY += 10;
      }

      for (const esc of escrutiniosFechados) {

        if (cursorY > PAGE_HEIGHT - BOTTOM_MARGIN - 60) {
          this.adicionarRodape(doc, MARGEM_ESQUERDA);
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(14);
        doc.text(`Resultados do ${esc.numero}º Escrutínio`, MARGEM_ESQUERDA, cursorY);
        cursorY += 8;

        const cacheKey = `${cargo.id}-${esc.numero}`;
        const resultados = this.apuracaoOrdenadaCache.get(cacheKey);
        const extras = this.apuracaoCache.get(cacheKey);

        if (!resultados || !extras) {
          doc.setFontSize(10);
          doc.text('Não foi possível carregar os dados desta apuração.', MARGEM_ESQUERDA, cursorY);
          cursorY += 10;
          continue;
        }

        const tableHead = [['Pos.', 'Candidato', 'Votos']];
        const tableBody = resultados.map((item, index) => [
          `${index + 1}º`,
          item.nome,
          item.votos.toString()
        ]);

        tableBody.push(['-', 'Votos em Branco', extras.totalBrancos.toString()]);
        tableBody.push(['-', 'Votos Nulos', extras.totalNulos.toString()]);

        const totalVotos = esc.votos.length;
        tableBody.push(['-', 'Total de Votos Registrados', totalVotos.toString()]);

        autoTable(doc, {
          head: tableHead,
          body: tableBody,
          startY: cursorY,
          theme: 'striped',
          headStyles: { fillColor: [0, 74, 152] },
          didDrawPage: (data) => {
            this.adicionarRodape(doc, MARGEM_ESQUERDA);
          }
        });

        cursorY = (doc as any).lastAutoTable.finalY + 15;
      }

      cursorY += 5;
      if (cursorY < PAGE_HEIGHT - BOTTOM_MARGIN) {
        doc.setDrawColor(180, 180, 180);
        doc.line(MARGEM_ESQUERDA, cursorY, 200, cursorY);
      }
      cursorY += 10;
    }

    this.adicionarRodape(doc, MARGEM_ESQUERDA);

    const safeFileName = eleicao.titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`relatorio_geral_${safeFileName}.pdf`);
  }


  /**
   * [NOVO HELPER] Adiciona rodapé com data e paginação
   */
  private adicionarRodape(doc: jsPDF, margemEsquerda: number): void {
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(100); // cinza
    // const pageNum = doc.internal.getCurrentPageInfo.name;
    doc.text(
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      margemEsquerda,
      doc.internal.pageSize.height - 10
    );
    doc.setTextColor(0);
  }
}
