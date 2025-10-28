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
  query
} from '@angular/fire/firestore';
import {  Cargo } from '../models/Cargo';
import { Escrutinio } from '../models/Escritineo'
import { Observable } from 'rxjs';
import { nanoid } from 'nanoid'; // Ótimo para IDs únicos (npm install nanoid)
import { Candidato } from '../models/Candidato';
import { AuthService } from '../services/auth.service'

@Injectable({
  providedIn: 'root'
})
export class EleicaoAdminService {

  private db = inject(Firestore);
  private authService = inject(AuthService);
  private eleicoesCollection = collection(this.db, 'eleicoes');


  async createEleicao(
    eleicaoData: Omit<Eleicao, 'id' | 'status' | 'cargoAbertoParaVotacao' | 'adminUid'>
  ): Promise<string> {

    const adminUid = this.authService.getCurrentUserUid();
    if (!adminUid) {
      throw new Error("Usuário não autenticado.");
    }

    const novoId = nanoid(10);
    const eleicaoRef = doc(this.db, 'eleicoes', novoId);

    // ... (lógica de processar cargos e escrutínios)
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
      adminUid: adminUid // <-- SALVA O ID DO ADMIN
    };

    await setDoc(eleicaoRef, novaEleicao);
    return novoId;
  }


  /**
   * Helper para criar os 3 escrutínios iniciais para um cargo.
   */
  private gerarEscrutiniosIniciais(candidatosIniciais: Candidato[]): Escrutinio[] {

    // Regra: "no primeiro todos participam, no segundo tambem"
    const escrutinio1: Escrutinio = {
      numero: 1,
      candidatos: candidatosIniciais,
      votos: [],
      status: 'nao_iniciado'
    };

    const escrutinio2: Escrutinio = {
      numero: 2,
      candidatos: candidatosIniciais, // Regra: "no segundo tambem [todos]"
      votos: [],
      status: 'nao_iniciado'
    };

    // Regra: "no terceiro, somente os dois com mais votos seguem"
    // No cadastro, deixamos os candidatos vazios. Serão preenchidos
    // pelo admin após a apuração do 2º escrutínio.
    const escrutinio3: Escrutinio = {
      numero: 3,
      candidatos: [], // Só será preenchido após apuração do 2º
      votos: [],
      status: 'nao_iniciado'
    };

    return [escrutinio1, escrutinio2, escrutinio3];
  }

 /**
   * Busca uma eleição pelo ID e retorna um Observable (atualiza em tempo real).
   */
  getEleicaoObservable(id: string): Observable<Eleicao> {
    const eleicaoRef = doc(this.db, 'eleicoes', id);
    // docData já faz o cast para o tipo <Eleicao>
    return docData(eleicaoRef) as Observable<Eleicao>;
  }

  /**
   * Atualiza partes de um documento de eleição.
   * Usaremos isso para salvar TODAS as nossas alterações (abrir/fechar escrutínio, etc.)
   */
  updateEleicao(id: string, updates: Partial<Eleicao>): Promise<void> {
    const eleicaoRef = doc(this.db, 'eleicoes', id);
    return updateDoc(eleicaoRef, updates);
  }

  /**
   * Busca todas as eleições criadas por um admin específico.
   */
  getEleicoesDoAdmin(adminUid: string): Observable<Eleicao[]> {
    const q = query(
      this.eleicoesCollection,
      where('adminUid', '==', adminUid)
      // você pode adicionar , orderBy('titulo') ou 'status' se criar índices
    );

    // collectionData retorna um array em tempo real
    return collectionData(q) as Observable<Eleicao[]>;
  }
}


