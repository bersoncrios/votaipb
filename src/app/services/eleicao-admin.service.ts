import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  updateDoc,
  docData,
  setDoc,
  where,
  collectionData,
  query,
  runTransaction
} from '@angular/fire/firestore';
import { Cargo, CargoStatus } from '../models/Cargo';
import { Escrutinio } from '../models/Escritineo';
import { Observable, map } from 'rxjs';
import { nanoid } from 'nanoid';
import { Candidato } from '../models/Candidato';
import { AuthService } from '../services/auth.service';
import { Eleicao } from './../models/Eleicao';

@Injectable({
  providedIn: 'root'
})
export class EleicaoAdminService {
  private db = inject(Firestore);
  private authService = inject(AuthService);
  private eleicoesCollection = collection(this.db, 'eleicoes');

  private normalizarEleicao(eleicao: Eleicao): Eleicao {
    if (!eleicao) return eleicao;

    const cargosNormalizados = (eleicao.cargos || []).map(cargo => {
      const vencedor = cargo.vencedor === undefined ? null : cargo.vencedor;

      const status: CargoStatus = cargo.status || (vencedor ? 'finalizado' : 'aguardando');

      return {
        ...cargo,
        status,
        vencedor
      };
    });

    return {
      ...eleicao,
      cargos: cargosNormalizados
    };
  }

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
      escrutinios: this.gerarEscrutiniosIniciais(cargo.candidatosIniciais),
      status: 'aguardando',
      vencedor: null
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
      candidatos: candidatosIniciais,
      votos: [],
      status: 'nao_iniciado'
    };

    const escrutinio3: Escrutinio = {
      numero: 3,
      candidatos: [],
      votos: [],
      status: 'nao_iniciado'
    };

    return [escrutinio1, escrutinio2, escrutinio3];
  }

  getEleicaoObservable(id: string): Observable<Eleicao> {
    const eleicaoRef = doc(this.db, 'eleicoes', id);
    return docData(eleicaoRef, { idField: 'id' }) as Observable<Eleicao>;
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

    return (collectionData(q, { idField: 'id' }) as Observable<Eleicao[]>).pipe(
      map(eleicoes => eleicoes.map(this.normalizarEleicao))
    );
  }

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

          const status = cargo.status || (cargo.vencedor ? 'finalizado' : 'aguardando');
          if (status !== 'aguardando') {
            return cargo;
          }

          const novosCandidatosIniciais = cargo.candidatosIniciais.filter(
            c => !candidatosIds.includes(c.userId)
          );

          const novosEscrutinios = this.gerarEscrutiniosIniciais(novosCandidatosIniciais);

          return {
            ...cargo,
            candidatosIniciais: novosCandidatosIniciais,
            escrutinios: novosEscrutinios,
            status: 'aguardando'
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

  async reiniciarCargo(eleicaoId: string, cargoId: string): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);

    try {
      await runTransaction(this.db, async (transaction) => {
        const eleicaoSnap = await transaction.get(eleicaoRef);
        if (!eleicaoSnap.exists()) {
          throw new Error('Eleição não encontrada para reiniciar cargo.');
        }

        const eleicaoData = eleicaoSnap.data() as Eleicao;

        const cargoIndex = eleicaoData.cargos.findIndex(c => c.id === cargoId);
        if (cargoIndex === -1) {
          throw new Error('Cargo não encontrado para reiniciar.');
        }

        const cargoParaResetar = eleicaoData.cargos[cargoIndex];

        const escrutiniosReiniciados = this.gerarEscrutiniosIniciais(
          cargoParaResetar.candidatosIniciais
        );

        eleicaoData.cargos[cargoIndex] = {
          ...cargoParaResetar,
          vencedor: null,
          status: 'aguardando',
          escrutinios: escrutiniosReiniciados
        };

        transaction.update(eleicaoRef, { cargos: eleicaoData.cargos });
      });
    } catch (e) {
      console.error('Erro ao reiniciar cargo:', e);
      throw e;
    }
  }

  private mapIdsToCandidatos(
    ids: string[],
    listaCompleta: Candidato[]
  ): Candidato[] {
    const candidatoMap = new Map(listaCompleta.map(c => [c.userId, c]));

    return ids
      .map(id => candidatoMap.get(id))
      .filter(Boolean) as Candidato[];
  }

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

        if (!escrutinio2 || escrutinio2.status === 'nao_iniciado') {
          throw new Error(
            'Escrutínio 2 não está em um estado válido para apuração.'
          );
        }

        if (!escrutinio3 || escrutinio3.status !== 'nao_iniciado') {
          throw new Error('Escrutínio 3 já foi iniciado ou não existe.');
        }

        const contagemVotos = new Map<string, number>();
        for (const candidato of escrutinio2.candidatos) {
          contagemVotos.set(candidato.userId, 0);
        }
        for (const voto of escrutinio2.votos) {
          if (contagemVotos.has(voto.candidatoId)) {
            const contagemAtual = contagemVotos.get(voto.candidatoId)!;
            contagemVotos.set(voto.candidatoId, contagemAtual + 1);
          }
        }
        const resultados = Array.from(contagemVotos.entries())
          .map(([candidatoId, totalVotos]) => ({ candidatoId, totalVotos }))
          .sort((a, b) => b.totalVotos - a.totalVotos);

        let candidatosIdsParaEscrutinio3: string[] = [];
        if (resultados.length <= 2) {
          candidatosIdsParaEscrutinio3 = resultados.map(r => r.candidatoId);
        } else {
          const primeiroLugarVotos = resultados[0].totalVotos;
          const segundoLugarVotos = resultados[1].totalVotos;

          const candidatosPrimeiroLugar = resultados.filter(
            r => r.totalVotos === primeiroLugarVotos
          );
          const candidatosSegundoLugar = resultados.filter(
            r => r.totalVotos === segundoLugarVotos
          );

          if (candidatosPrimeiroLugar.length > 1) {
            candidatosIdsParaEscrutinio3 = candidatosPrimeiroLugar.map(
              r => r.candidatoId
            );
          } else if (candidatosSegundoLugar.length > 1) {
            candidatosIdsParaEscrutinio3 = [
              ...candidatosPrimeiroLugar.map(r => r.candidatoId),
              ...candidatosSegundoLugar.map(r => r.candidatoId)
            ];
          } else {
            candidatosIdsParaEscrutinio3 = [
              candidatosPrimeiroLugar[0].candidatoId,
              candidatosSegundoLugar[0].candidatoId
            ];
          }
        }

        const candidatosParaEscrutinio3 = this.mapIdsToCandidatos(
          candidatosIdsParaEscrutinio3,
          escrutinio2.candidatos
        );

        const escrutinio3Index = cargo.escrutinios.findIndex(
          e => e.numero === 3
        );
        cargo.escrutinios[escrutinio3Index].candidatos =
          candidatosParaEscrutinio3;

        const escrutinio2Index = cargo.escrutinios.findIndex(
          e => e.numero === 2
        );
        cargo.escrutinios[escrutinio2Index].status = 'fechado';

        transaction.update(eleicaoRef, {
          cargos: cargosAtualizados
        });
      });
    } catch (e) {
      console.error('Erro ao preparar o terceiro escrutínio:', e);
      throw e;
    }
  }

  async prepararProximoEscrutinio(
    eleicaoId: string,
    cargoId: string,
    numeroNovoEscrutinio: number,
    candidatos: Candidato[]
  ): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);

    try {
      await runTransaction(this.db, async transaction => {
        const eleicaoSnap = await transaction.get(eleicaoRef);
        if (!eleicaoSnap.exists()) {
          throw new Error('Eleição não encontrada.');
        }

        const eleicaoData = eleicaoSnap.data() as Eleicao;
        const cargosAtualizados = eleicaoData.cargos.map(c => ({
          ...c,
          escrutinios: c.escrutinios.map(e => ({ ...e, votos: [...e.votos] }))
        }));

        const cargoIndex = cargosAtualizados.findIndex(c => c.id === cargoId);
        if (cargoIndex === -1) {
          throw new Error('Cargo não encontrado.');
        }

        const cargo = cargosAtualizados[cargoIndex];

        const escrutinioAnterior = cargo.escrutinios.find(e => e.numero === numeroNovoEscrutinio - 1);
        if (escrutinioAnterior) {
          escrutinioAnterior.status = 'fechado';
        }

        const existe = cargo.escrutinios.some(e => e.numero === numeroNovoEscrutinio);
        if (existe) {
          throw new Error(`Escrutínio ${numeroNovoEscrutinio} já existe.`);
        }

        const novoEscrutinio: Escrutinio = {
          numero: numeroNovoEscrutinio,
          candidatos: candidatos,
          votos: [],
          status: 'aberto'
        };

        cargo.escrutinios.push(novoEscrutinio);
        cargo.status = 'em_votacao';
        (cargo as any).candidatosEmpatados = [];

        transaction.update(eleicaoRef, {
          cargos: cargosAtualizados,
          cargoAbertoParaVotacao: {
            cargoId: cargoId,
            escrutinioNum: numeroNovoEscrutinio
          }
        });
      });
    } catch (e) {
      console.error(`Erro ao preparar ${numeroNovoEscrutinio}º escrutínio:`, e);
      throw e;
    }
  }
}
