import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { Eleicao } from '../../../../models/Eleicao';
import { Cargo } from '../../../../models/Cargo';
import { Escrutinio } from '../../../../models/Escritineo';
import { Candidato } from '../../../../models/Candidato';

import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { cloneDeep } from 'lodash-es';
import Swal from 'sweetalert2';

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
  public apuracaoCache = new Map<string, ApuracaoResultado>(); // Cache para resultados
  public apuracaoOrdenadaCache = new Map<string, ApuracaoOrdenadaItem[]>();

  ngOnInit(): void {
    this.eleicao$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          throw new Error('ID da eleição não fornecido');
        }
        return this.eleicaoAdminService.getEleicaoObservable(id);
      })
    );
  }

  /**
   * Lógica para abrir um escrutínio
   */
  async onAbrirEscrutinio(eleicao: Eleicao, cargo: Cargo, escrutinio: Escrutinio) {
    if (eleicao.cargoAbertoParaVotacao) {
      Swal.fire('Atenção', 'Já existe um escrutínio aberto. Feche-o antes de abrir outro.', 'warning');
      return;
    }
    const novosCargos = cloneDeep(eleicao.cargos);

    const cargoAtual = novosCargos.find(c => c.id === cargo.id);
    const escrutinioAtual = cargoAtual?.escrutinios.find(e => e.numero === escrutinio.numero);

    if (escrutinioAtual) {
      escrutinioAtual.status = 'aberto';
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
   * ATUALIZADO: Agora chama o service para remover candidatos eleitos
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

    // Regra: 50% + 1 nos escrutínios 1 ou 2
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
    // Regra: Mais votado no escrutínio 3
    else if (escrutinio.numero === 3) {
      if (totalVotosValidos > 0 && apuracaoOrdenada.length > 0) {
        // O primeiro da lista ordenada é o vencedor
        const vencedorId = apuracaoOrdenada[0].userId;
        vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
      }
    }

    // 6. Prepara a atualização no Firestore
    const updates: Partial<Eleicao> = {
      cargoAbertoParaVotacao: null // Fecha a votação
    };

    let idDoVencedor: string | null = null; // Flag para chamar o service

    if (vencedorEncontrado) {
      cargoAtual.vencedor = vencedorEncontrado;
      idDoVencedor = vencedorEncontrado.userId; // Salva o ID para chamar o service
      Swal.fire('Eleição Finalizada!', `Eleição para ${cargo.titulo} finalizada. Vencedor: ${vencedorEncontrado.nome}`, 'success');

    } else {
      if (escrutinio.numero < 3) {
        Swal.fire('Escrutínio Fechado', `Escrutínio ${escrutinio.numero} fechado. Nenhum candidato atingiu mais de 50%. Prossiga para o próximo escrutínio.`, 'info');
      } else {
        Swal.fire('Escrutínio Fechado', 'Escrutínio 3 fechado. Nenhum vencedor por maioria simples.', 'info');
      }
    }

    updates.cargos = novosCargos;
    const todosCargosFinalizados = novosCargos.every(c => c.vencedor !== null && c.vencedor !== undefined);

    if (todosCargosFinalizados) {
      updates.status = 'finalizada';
      Swal.fire('Eleição Encerrada!', `Todos os cargos foram preenchidos. A eleição "${eleicao.titulo}" foi encerrada.`, 'success');
    }

    try {
      // 1. Aplica a atualização principal (fecha escrutínio, define vencedor, etc.)
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);

      // 2. SE HOUVE UM VENCEDOR, chama o service transacional para removê-lo
      if (idDoVencedor) {
        console.log(`Chamando service para remover ${idDoVencedor} de outros cargos...`);
        await this.eleicaoAdminService.removerCandidatosEleitosDeOutrosCargos(
          eleicao.id,
          [idDoVencedor], // A função do service espera um array de IDs
          cargo.id
        );
      }

    } catch (e) {
      console.error('Erro ao fechar escrutínio ou ao remover candidato:', e);
      Swal.fire('Erro!', `Ocorreu um erro ao fechar o escrutínio: ${e}`, 'error');
    }
  }

  /**
   * Helper privado que APENAS conta os votos e retorna os resultados.
   */
  private _apurarVotos(escrutinio: Escrutinio): { apuracao: ApuracaoResultado, totalVotosValidos: number } {
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
   * ATUALIZADO: Agora apenas chama o service que contém a regra correta (Top 2 + Empates)
   */
  async onPreparar3Escrutinio(eleicao: Eleicao, cargo: Cargo) {
    const escrutinio2 = cargo.escrutinios.find(e => e.numero === 2);
    if (escrutinio2?.status !== 'fechado') {
      Swal.fire('Atenção', 'É preciso fechar o 2º Escrutínio antes de preparar o 3º.', 'warning');
      return;
    }

    // Validação extra: O 3º escrutínio já não foi preparado?
    const escrutinio3 = cargo.escrutinios.find(e => e.numero === 3);
    if (escrutinio3?.candidatos && escrutinio3.candidatos.length > 0) {
      Swal.fire('Atenção', 'O 3º Escrutínio já foi preparado e contém candidatos.', 'info');
      return;
    }

    try {
      // Chama a função centralizada no service, que contém a regra correta
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

    if (cargoAtual.vencedor) {
      Swal.fire('Atenção', 'Este cargo já possui um vencedor registrado.', 'info');
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
      try {
        await this.eleicaoAdminService.updateEleicao(eleicao.id, { cargos: novosCargos });
        Swal.fire('Sucesso!', `CORRIGIDO: Vencedor ${vencedorEncontrado.nome} foi definido para o cargo ${cargo.titulo}.`, 'success');
      } catch (e) {
        console.error('Erro ao forçar re-apuração:', e);
      }
    } else {
      Swal.fire('Concluído', 'Nenhum vencedor encontrado após re-apuração. A eleição continua para o 3º escrutínio.', 'info');
    }
  }
}
