import { Eleicao } from './../models/Eleicao';
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
  runTransaction // <-- ATUALIZADO: Importar runTransaction
} from '@angular/fire/firestore';
import { Cargo } from '../models/Cargo';
import { Escrutinio } from '../models/Escritineo';
import { Observable } from 'rxjs';
import { nanoid } from 'nanoid';
import { Candidato } from '../models/Candidato';
import { AuthService } from '../services/auth.service';

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

  // ##################################################################
  // ## NOVA FUNÇÃO ADICIONADA
  // ##################################################################

  /**
   * Remove candidatos eleitos (ex: Presidente e Vice) dos outros cargos
   * que ainda não começaram a ser votados.
   *
   * @param eleicaoId O ID da eleição
   * @param candidatosIds Array de IDs dos candidatos que foram eleitos
   * @param cargoIdOndeForamEleitos O ID do cargo onde eles acabaram de ser eleitos (para não removê-los deste)
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

        // Mapeia os cargos para criar um novo array atualizado
        const cargosAtualizados = eleicaoData.cargos.map(cargo => {
          // 1. Se for o cargo onde eles acabaram de ser eleitos, não faz nada
          if (cargo.id === cargoIdOndeForamEleitos) {
            return cargo;
          }

          // 2. Se for qualquer outro cargo, remove os IDs dos candidatos eleitos

          // Remove da lista principal de candidatos iniciais do cargo
          const novosCandidatosIniciais = cargo.candidatosIniciais.filter(
            c => !candidatosIds.includes(c.userId)
          );

          // Remove dos escrutínios que ainda não iniciaram
          const novosEscrutinios = cargo.escrutinios.map(esc => {
            // Se o escrutínio já começou ou terminou, não mexe
            if (esc.status !== 'nao_iniciado') {
              return esc;
            }

            // Se não iniciou, filtra os candidatos
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

        // 3. Atualiza o documento inteiro com o novo array de cargos
        transaction.update(eleicaoRef, {
          cargos: cargosAtualizados
        });
      });
    } catch (e) {
      console.error('Erro ao remover candidatos eleitos de outros cargos:', e);
      throw e;
    }
  }
}
