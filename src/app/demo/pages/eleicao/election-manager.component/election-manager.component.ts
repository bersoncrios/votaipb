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
      alert('Já existe um escrutínio aberto. Feche-o antes de abrir outro.');
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
      alert(`Escrutínio ${escrutinio.numero} para ${cargo.titulo} aberto!`);
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
    else if (escrutinio.numero === 3) {
      if (totalVotosValidos > 0) {
        const [vencedorId, _votosVencedor] =
          [...apuracao.votosPorCandidato.entries()]
          .sort((a, b) => b[1] - a[1])[0];

        vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
      }
    }

    // 6. Prepara a atualização no Firestore
    const updates: Partial<Eleicao> = {
      cargoAbertoParaVotacao: null // Fecha a votação
    };

    if (vencedorEncontrado) {
      cargoAtual.vencedor = vencedorEncontrado;
      alert(`Eleição para ${cargo.titulo} finalizada. Vencedor: ${vencedorEncontrado.nome}`);
      this._removerCandidatoDeOutrosCargos(novosCargos, vencedorEncontrado.userId, cargo.id);

    } else {
      if (escrutinio.numero < 3) {
        alert(`Escrutínio ${escrutinio.numero} fechado. Nenhum candidato atingiu mais de 50%. Prossiga para o próximo escrutínio.`);
      } else {
        alert(`Escrutínio 3 fechado.`);
      }
    }

    updates.cargos = novosCargos;
    const todosCargosFinalizados = novosCargos.every(c => c.vencedor !== null && c.vencedor !== undefined);

    if (todosCargosFinalizados) {
      updates.status = 'finalizada';
      alert(`Todos os cargos foram preenchidos. A eleição "${eleicao.titulo}" foi encerrada.`);
    }

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);
    } catch (e) {
      console.error('Erro ao fechar escrutínio:', e);
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
   */
  async onPreparar3Escrutinio(eleicao: Eleicao, cargo: Cargo) {
    const escrutinio2 = cargo.escrutinios.find(e => e.numero === 2);
    if (escrutinio2?.status !== 'fechado') {
      alert('É preciso fechar o 2º Escrutínio antes de preparar o 3º.');
      return;
    }

    const cacheKey = `${cargo.id}-2`;
    if (!this.apuracaoCache.has(cacheKey)) {
      this.onApurar(cargo, escrutinio2); // Apura se não estiver no cache
    }
    const resultados2 = this.apuracaoCache.get(cacheKey)!;

    const votosOrdenados = Array.from(resultados2.votosPorCandidato.entries())
                                .sort((a, b) => b[1] - a[1]); // Ordena do maior para o menor

    const top2Ids = votosOrdenados.slice(0, 2).map(entry => entry[0]);

    const top2CandidatosIniciais: Candidato[] = cargo.candidatosIniciais.filter(
      c => top2Ids.includes(c.userId)
    );

    const vencedoresIds = eleicao.cargos
        .filter(c => c.id !== cargo.id && c.vencedor)
        .map(c => c.vencedor!.userId);

    const top2Candidatos = top2CandidatosIniciais.filter(
      c => !vencedoresIds.includes(c.userId)
    );

    if (top2Candidatos.length === 0) {
      alert('Não houve candidatos válidos (que já não sejam vencedores) para o 3º escrutínio.');
      return;
    }

    // Atualiza o documento
    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;
    const escrutinio3 = cargoAtual.escrutinios.find(e => e.numero === 3)!;

    escrutinio3.candidatos = top2Candidatos; // <- AQUI A REGRA DE NEGÓCIO

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, { cargos: novosCargos });

      const nomes = top2Candidatos.map(c => c.nome).join(' e ');
      alert(`3º Escrutínio preparado com ${top2Candidatos.length} candidato(s): ${nomes}.`);

    } catch (e) {
      console.error('Erro ao preparar 3º escrutínio:', e);
    }
  }

  /**
   * Copia o link público de votação
   */
  async onCopiarLink(eleicaoId: string) {
    const origin = window.location.origin; // Pega 'http://localhost:4200' ou 'https://seu-dominio.com'
    const link = `${origin}/votar/${eleicaoId}`; // Monta o link público

    try {
      await navigator.clipboard.writeText(link);
      alert(`Link de votação copiado!\n\n${link}`);
    } catch (err) {
      console.error('Falha ao copiar link: ', err);
      alert(`Falha ao copiar. Copie manually:\n\n${link}`);
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
    alert('Forçando re-apuração... Verificando 1º e 2º escrutínios.');

    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;

    if (cargoAtual.vencedor) {
      alert('Este cargo já possui um vencedor registrado.');
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

    // Se, após tudo isso, encontramos um vencedor
    if (vencedorEncontrado) {
      cargoAtual.vencedor = vencedorEncontrado;
      try {
        await this.eleicaoAdminService.updateEleicao(eleicao.id, { cargos: novosCargos });
        alert(`CORRIGIDO: Vencedor ${vencedorEncontrado.nome} foi definido para o cargo ${cargo.titulo}.`);
      } catch (e) {
        console.error('Erro ao forçar re-apuração:', e);
      }
    } else {
      alert('Nenhum vencedor encontrado após re-apuração. A eleição continua para o 3º escrutínio.');
    }
  }

  private _removerCandidatoDeOutrosCargos(cargos: Cargo[], userIdParaRemover: string, cargoIdDoVencedor: string) {
    console.log(`Aplicando regra: Removendo ${userIdParaRemover} de futuros cargos.`);

    for (const cargo of cargos) {
      if (cargo.id === cargoIdDoVencedor) {
        continue;
      }
      if (cargo.vencedor) {
        continue;
      }
      for (const escrutinio of cargo.escrutinios) {
        if (escrutinio.status === 'nao_iniciado') {
          const index = escrutinio.candidatos.findIndex(c => c.userId === userIdParaRemover);
          if (index > -1) {
            console.log(`REMOVIDO ${userIdParaRemover} do escrutínio ${escrutinio.numero} do cargo ${cargo.titulo}`);
            escrutinio.candidatos.splice(index, 1);
          }
        }
      }
    }
  }
}
