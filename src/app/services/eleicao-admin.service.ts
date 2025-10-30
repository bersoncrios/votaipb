// src/app/admin/eleicao-admin.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  docData,
  setDoc,
  CollectionReference,
  DocumentData,
  where,
  collectionData,
  query,
  runTransaction // <-- Importar runTransaction
} from '@angular/fire/firestore';
import { Cargo } from '../models/Cargo';
import { Escrutinio } from '../models/Escritineo';
import { Observable } from 'rxjs';
import { nanoid } from 'nanoid';
import { Candidato } from '../models/Candidato'; // <-- Importação já estava aqui
import { AuthService } from '../services/auth.service';
import { Eleicao } from './../models/Eleicao'; // <-- Importação já estava aqui

@Injectable({
  providedIn: 'root'
})
export class EleicaoAdminService {
  private db = inject(Firestore);
  private authService = inject(AuthService);
  private eleicoesCollection = collection(this.db, 'eleicoes');

  async createEleicao(
    eleicaoData: Omit<
      Eleicao,
      'id' | 'status' | 'cargoAbertoParaVotacao' | 'adminUid'
    >
  ): Promise<string> {
    const adminUid = this.authService.getCurrentUserUid();
    if (!adminUid) {
      throw new Error('Usuário não autenticado.');
    }

    const novoId = nanoid(10);
    const eleicaoRef = doc(this.db, 'eleicoes', novoId);

    const cargosProcessados: Cargo[] = eleicaoData.cargos.map(cargo => ({
      ...cargo,
      id: cargo.id || nanoid(8),
      escrutinios: this.gerarEscrutiniosIniciais(cargo.candidatosIniciais)
    }));

    const novaEleicao: Eleicao = {
      ...eleicaoData,
      id: novoId,
      cargos: cargosProcessados,
      status: 'agendada',
      cargoAbertoParaVotacao: null,
      adminUid: adminUid
    };

    await setDoc(eleicaoRef, novaEleicao);
    return novoId;
  }

  private gerarEscrutiniosIniciais(
    candidatosIniciais: Candidato[]
  ): Escrutinio[] {
    const escrutinio1: Escrutinio = {
      numero: 1,
      candidatos: candidatosIniciais,
      votos: [],
      status: 'nao_iniciado'
    };

    const escrutinio2: Escrutinio = {
      numero: 2,
      candidatos: candidatosIniciais, // No 2º escrutínio, por padrão, começam todos
      votos: [],
      status: 'nao_iniciado'
    };

    const escrutinio3: Escrutinio = {
      numero: 3,
      candidatos: [], // O 3º escrutínio começa vazio
      votos: [],
      status: 'nao_iniciado'
    };

    return [escrutinio1, escrutinio2, escrutinio3];
  }

  getEleicaoObservable(id: string): Observable<Eleicao> {
    const eleicaoRef = doc(this.db, 'eleicoes', id);
    return docData(eleicaoRef) as Observable<Eleicao>;
  }

  updateEleicao(id: string, updates: Partial<Eleicao>): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', id);
    return updateDoc(eleicaoRef, updates);
  }

  getEleicoesDoAdmin(adminUid: string): Observable<Eleicao[]> {
    const q = query(
      this.eleicoesCollection,
      where('adminUid', '==', adminUid)
    );
    return collectionData(q) as Observable<Eleicao[]>;
  }

  /**
   * Remove candidatos eleitos (ex: Presidente e Vice) dos outros cargos
   * que ainda não começaram a ser votados.
   */
  async removerCandidatosEleitosDeOutrosCargos(
    eleicaoId: string,
    candidatosIds: string[],
    cargoIdOndeForamEleitos: string
  ): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);

    try {
      await runTransaction(this.db, async transaction => {
        const eleicaoSnap = await transaction.get(eleicaoRef);
        if (!eleicaoSnap.exists()) {
          throw new Error('Eleição não encontrada para remover candidatos.');
        }

        const eleicaoData = eleicaoSnap.data() as Eleicao;

        const cargosAtualizados = eleicaoData.cargos.map(cargo => {
          if (cargo.id === cargoIdOndeForamEleitos) {
            return cargo;
          }

          const novosCandidatosIniciais = cargo.candidatosIniciais.filter(
            c => !candidatosIds.includes(c.userId)
          );

          const novosEscrutinios = cargo.escrutinios.map(esc => {
            if (esc.status !== 'nao_iniciado') {
              return esc;
            }

            const novosCandidatosEscrutinio = esc.candidatos.filter(
              c => !candidatosIds.includes(c.userId)
            );

            return {
              ...esc,
              candidatos: novosCandidatosEscrutinio
            };
          });

          return {
            ...cargo,
            candidatosIniciais: novosCandidatosIniciais,
            escrutinios: novosEscrutinios
          };
        });

        transaction.update(eleicaoRef, {
          cargos: cargosAtualizados
        });
      });
    } catch (e) {
      console.error('Erro ao remover candidatos eleitos de outros cargos:', e);
      throw e;
    }
  }

  // ##################################################################
  // ## NOVAS FUNÇÕES ADICIONADAS PARA SUA REGRA
  // ##################################################################

  /**
   * Função auxiliar para converter IDs de candidatos em objetos Candidato.
   */
  private mapIdsToCandidatos(
    ids: string[],
    listaCompleta: Candidato[]
  ): Candidato[] {
    // Usar um Map para busca rápida O(n) em vez de O(n*m)
    const candidatoMap = new Map(listaCompleta.map(c => [c.userId, c]));

    // Mapear os IDs para os objetos completos
    return ids
      .map(id => candidatoMap.get(id))
      .filter(Boolean) as Candidato[]; // filter(Boolean) remove nulos se algum ID não for encontrado
  }

  /**
   * Prepara o 3º escrutínio com base nos resultados do 2º.
   * Pega os 2 mais votados, ou mais em caso de empate no 2º lugar.
   * Esta função deve ser chamada pelo admin após fechar o 2º escrutínio.
   *
   * @param eleicaoId ID da Eleição
   * @param cargoId ID do Cargo a ser processado
   */
  async prepararTerceiroEscrutinio(
    eleicaoId: string,
    cargoId: string
  ): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);

    try {
      await runTransaction(this.db, async transaction => {
        const eleicaoSnap = await transaction.get(eleicaoRef);
        if (!eleicaoSnap.exists()) {
          throw new Error('Eleição não encontrada.');
        }

        const eleicaoData = eleicaoSnap.data() as Eleicao;

        // Clone profundo dos cargos para atualização na transação
        const cargosAtualizados = eleicaoData.cargos.map(c => ({
          ...c,
          escrutinios: c.escrutinios.map(e => ({ ...e, votos: [...e.votos] }))
        }));

        const cargoIndex = cargosAtualizados.findIndex(c => c.id === cargoId);
        if (cargoIndex === -1) {
          throw new Error('Cargo não encontrado.');
        }

        const cargo = cargosAtualizados[cargoIndex];

        const escrutinio2 = cargo.escrutinios.find(e => e.numero === 2);
        const escrutinio3 = cargo.escrutinios.find(e => e.numero === 3);

        // O escrutínio 2 deve ter sido concluído (ou estar aberto para ser fechado agora)
        if (!escrutinio2 || escrutinio2.status === 'nao_iniciado') {
          throw new Error(
            'Escrutínio 2 não está em um estado válido para apuração.'
          );
        }

        if (!escrutinio3 || escrutinio3.status !== 'nao_iniciado') {
          throw new Error('Escrutínio 3 já foi iniciado ou não existe.');
        }

        // 1. Calcular os resultados do Escrutínio 2
        const contagemVotos = new Map<string, number>();

        // Garante que todos os candidatos do escrutínio 2 comecem com 0 votos
        for (const candidato of escrutinio2.candidatos) {
          contagemVotos.set(candidato.userId, 0);
        }

        // Soma os votos
        for (const voto of escrutinio2.votos) {
          // Ignora votos em branco ou nulos que não estão na lista de candidatos
          if (contagemVotos.has(voto.candidatoId)) {
            const contagemAtual = contagemVotos.get(voto.candidatoId)!;
            contagemVotos.set(voto.candidatoId, contagemAtual + 1);
          }
        }

        // 2. Classificar os resultados
        const resultados = Array.from(contagemVotos.entries())
          .map(([candidatoId, totalVotos]) => ({ candidatoId, totalVotos }))
          .sort((a, b) => b.totalVotos - a.totalVotos); // Ordena do maior para o menor

        let candidatosIdsParaEscrutinio3: string[] = [];

        // 3. Aplicar a lógica de seleção pedida
        if (resultados.length <= 2) {
          // Se houver 2 ou menos candidatos, todos avançam
          candidatosIdsParaEscrutinio3 = resultados.map(r => r.candidatoId);
        } else {
          // Se houver mais de 2 candidatos, aplicamos a regra
          const primeiroLugarVotos = resultados[0].totalVotos;
          const segundoLugarVotos = resultados[1].totalVotos;

          const candidatosPrimeiroLugar = resultados.filter(
            r => r.totalVotos === primeiroLugarVotos
          );
          const candidatosSegundoLugar = resultados.filter(
            r => r.totalVotos === segundoLugarVotos
          );

          if (candidatosPrimeiroLugar.length > 1) {
            // Cenário: Empate no 1º lugar (ex: A=10, B=10, C=5)
            // Todos empatados no 1º avançam. O 2º lugar (C) é ignorado.
            candidatosIdsParaEscrutinio3 = candidatosPrimeiroLugar.map(
              r => r.candidatoId
            );
          } else if (candidatosSegundoLugar.length > 1) {
            // Cenário: 1º claro, empate no 2º (ex: A=10, B=5, C=5)
            // O 1º e TODOS os empatados no 2º avançam.
            candidatosIdsParaEscrutinio3 = [
              ...candidatosPrimeiroLugar.map(r => r.candidatoId),
              ...candidatosSegundoLugar.map(r => r.candidatoId)
            ];
          } else {
            // Cenário: 1º e 2º claros (ex: A=10, B=5, C=2)
            // Apenas os dois primeiros avançam.
            candidatosIdsParaEscrutinio3 = [
              candidatosPrimeiroLugar[0].candidatoId,
              candidatosSegundoLugar[0].candidatoId
            ];
          }
        }

        // 4. Mapear IDs de volta para objetos Candidato
        // Usamos a lista do escrutínio 2 como fonte da verdade dos dados do candidato
        const candidatosParaEscrutinio3 = this.mapIdsToCandidatos(
          candidatosIdsParaEscrutinio3,
          escrutinio2.candidatos
        );

        // 5. Atualizar o documento
        const escrutinio3Index = cargo.escrutinios.findIndex(
          e => e.numero === 3
        );

        // Atualiza o escrutínio 3 com a lista correta de candidatos
        cargo.escrutinios[escrutinio3Index].candidatos =
          candidatosParaEscrutinio3;
        // O status continua 'nao_iniciado' até o admin decidir abrir

        // Opcional: Garante que o escrutínio 2 seja marcado como 'concluido'
        // (Se você já não fez isso em outra função)
        const escrutinio2Index = cargo.escrutinios.findIndex(
          e => e.numero === 2
        );
        cargo.escrutinios[escrutinio2Index].status = 'fechado';

        // Atualiza o array de cargos na transação
        transaction.update(eleicaoRef, {
          cargos: cargosAtualizados
        });
      });
    } catch (e) {
      console.error('Erro ao preparar o terceiro escrutínio:', e);
      throw e;
    }
  }
}
