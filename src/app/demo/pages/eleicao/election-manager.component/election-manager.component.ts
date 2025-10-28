// src/app/admin/eleicao-manage/eleicao-manage.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { Eleicao } from '../../../../models/Eleicao';
import { Cargo } from '../../../../models/Cargo';
import { Escrutinio } from '../../../../models/Escritineo';
import { Candidato } from '../../../../models/Candidato';

import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // Necessário para AsyncPipe, *ngIf, *ngFor
import { cloneDeep } from 'lodash-es'; // (npm install lodash-es @types/lodash-es)

// Tipo para os resultados da apuração
type ApuracaoResultado = {
  votosPorCandidato: Map<string, number>;
  totalBrancos: number;
  totalNulos: number;
};

@Component({
  selector: 'app-eleicao-manage',
  standalone: true, // Vamos fazer este standalone
  imports: [CommonModule], // Importa CommonModule para *ngIf, *ngFor, AsyncPipe
  templateUrl: './election-manager.component.html',
  styleUrls: ['./election-manager.component.scss']
})
export class EleicaoManageComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private eleicaoAdminService = inject(EleicaoAdminService);

  public eleicao$!: Observable<Eleicao>;
  public apuracaoCache = new Map<string, ApuracaoResultado>(); // Cache para resultados

  ngOnInit(): void {
    // Pega o 'id' da URL e usa-o para buscar a eleição
    this.eleicao$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          // Lidar com erro (ex: redirecionar)
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

    // Clonamos os dados para evitar mutação
    const novosCargos = cloneDeep(eleicao.cargos);

    // Encontra e atualiza o status no clone
    const cargoAtual = novosCargos.find(c => c.id === cargo.id);
    const escrutinioAtual = cargoAtual?.escrutinios.find(e => e.numero === escrutinio.numero);

    if (escrutinioAtual) {
      escrutinioAtual.status = 'aberto';
    } else {
      console.error('Falha ao encontrar escrutínio para abrir.');
      return;
    }

    try {
      // Prepara os dados da atualização
      const updates: Partial<Eleicao> = {
        cargos: novosCargos,
        status: 'em_andamento', // Marca a eleição toda como 'em_andamento'
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

    // 1. Fecha o status
    escrutinioAtual.status = 'fechado';

    // 2. Apura os votos (ANTES de salvar)
    const { apuracao, totalVotosValidos } = this._apurarVotos(escrutinioAtual);

    // 3. Salva no cache para o template
    const cacheKey = `${cargo.id}-${escrutinio.numero}`;
    this.apuracaoCache.set(cacheKey, apuracao);

    let vencedorEncontrado: Candidato | undefined = undefined;

    // 4. APLICA A REGRA (50% + 1) para 1º e 2º escrutínios
    if (escrutinio.numero === 1 || escrutinio.numero === 2) {
      if (totalVotosValidos > 0) {

        // Correção do linter (TS6133): _votosVencedor
        const [vencedorId, _votosVencedor] =
          [...apuracao.votosPorCandidato.entries()]
          .find(([id, contagem]) => contagem > (totalVotosValidos / 2)) || [];

        if (vencedorId) {
          vencedorEncontrado = cargo.candidatosIniciais.find(c => c.userId === vencedorId);
        }
      }
    }
    // 5. APLICA A REGRA (Maioria Simples) para 3º escrutínio
    else if (escrutinio.numero === 3) {
      if (totalVotosValidos > 0) {

        // Correção do linter (TS6133): _votosVencedor
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
      // REGRA: Se um vencedor foi encontrado, marca o cargo
      cargoAtual.vencedor = vencedorEncontrado;
      alert(`Eleição para ${cargo.titulo} finalizada. Vencedor: ${vencedorEncontrado.nome}`);
    } else {
      // REGRA: Se ninguém venceu...
      if (escrutinio.numero < 3) {
        alert(`Escrutínio ${escrutinio.numero} fechado. Nenhum candidato atingiu mais de 50%. Prossiga para o próximo escrutínio.`);
      } else {
        alert(`Escrutínio 3 fechado.`);
      }
    }

    // 7. Salva as mudanças (status fechado E o possível vencedor)
    updates.cargos = novosCargos;

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, updates);
    } catch (e) {
      console.error('Erro ao fechar escrutínio:', e);
    }
  }

  /**
   * Helper privado que APENAS conta os votos e retorna os resultados.
   * (CORRIGIDO: usava 'candidato.userId' em vez de 'voto.candidatoId')
   */
  private _apurarVotos(escrutinio: Escrutinio): { apuracao: ApuracaoResultado, totalVotosValidos: number } {
    const votos = escrutinio.votos || [];
    const resultados = new Map<string, number>();
    let totalBrancos = 0;
    let totalNulos = 0;

    // Inicializa o mapa com todos os candidatos do escrutínio
    for (const candidato of escrutinio.candidatos) {
      resultados.set(candidato.userId, 0);
    }

    // Processa os votos
    for (const voto of votos) {
      if (voto.candidatoId === 'BRANCO') {
        totalBrancos++;
      } else if (voto.candidatoId === 'NULO') {
        totalNulos++;
      } else if (resultados.has(voto.candidatoId)) {

        // ****** ESTA É A CORREÇÃO DO BUG ******
        resultados.set(voto.candidatoId, resultados.get(voto.candidatoId)! + 1);
        // *************************************

      }
    }

    // Calcula o total de votos VÁLIDOS (exclui brancos e nulos)
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
   * (CORRIGIDO: agora reutiliza _apurarVotos, sem lógica duplicada)
   */
  onApurar(cargo: Cargo, escrutinio: Escrutinio) {
    // 1. Reutiliza a lógica de apuração
    const { apuracao } = this._apurarVotos(escrutinio);

    // 2. Salva no cache para exibição no template
    const cacheKey = `${cargo.id}-${escrutinio.numero}`;
    this.apuracaoCache.set(cacheKey, apuracao);
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

    // Pega a apuração do 2º escrutínio
    const cacheKey = `${cargo.id}-2`;
    if (!this.apuracaoCache.has(cacheKey)) {
      this.onApurar(cargo, escrutinio2); // Apura se não estiver no cache
    }
    const resultados2 = this.apuracaoCache.get(cacheKey)!;

    // Converte o Map para um array [userId, contagem] e ordena
    const votosOrdenados = Array.from(resultados2.votosPorCandidato.entries())
                                .sort((a, b) => b[1] - a[1]); // Ordena do maior para o menor

    // Pega os 2 mais votados (Top 2)
    const top2Ids = votosOrdenados.slice(0, 2).map(entry => entry[0]);

    // Busca os objetos 'Candidato' completos
    const top2Candidatos: Candidato[] = cargo.candidatosIniciais.filter(
      c => top2Ids.includes(c.userId)
    );

    if (top2Candidatos.length < 2) {
      alert('Não houve votos suficientes para definir 2 finalistas.');
      return;
    }

    // Atualiza o documento
    const novosCargos = cloneDeep(eleicao.cargos);
    const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;
    const escrutinio3 = cargoAtual.escrutinios.find(e => e.numero === 3)!;

    escrutinio3.candidatos = top2Candidatos; // <- AQUI A REGRA DE NEGÓCIO

    try {
      await this.eleicaoAdminService.updateEleicao(eleicao.id, { cargos: novosCargos });
      alert(`3º Escrutínio preparado com os candidatos: ${top2Candidatos[0].nome} e ${top2Candidatos[1].nome}.`);
    } catch (e) {
      console.error('Erro ao preparar 3º escrutínio:', e);
    }
  }

getCandidatoNome(cargo: Cargo, userId: string): string {
    return cargo.candidatosIniciais.find(c => c.userId === userId)?.nome || 'Desconhecido';
  }

  // Adicione esta função em qualquer lugar dentro da classe EleicaoManageComponent
async onForcarReapuracao(eleicao: Eleicao, cargo: Cargo) {
  alert('Forçando re-apuração... Verificando 1º e 2º escrutínios.');

  const novosCargos = cloneDeep(eleicao.cargos);
  const cargoAtual = novosCargos.find(c => c.id === cargo.id)!;

  // Se o cargo já tem vencedor, não faz nada
  if (cargoAtual.vencedor) {
    alert('Este cargo já possui um vencedor registrado.');
    return;
  }

  let vencedorEncontrado: Candidato | undefined = undefined;

  // Roda a lógica de verificação para o 1º Escrutínio (se estiver fechado)
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

  // Se NÃO encontrou vencedor no 1º, verifica o 2º (se estiver fechado)
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
}
