import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  runTransaction
} from '@angular/fire/firestore';

import { Eleicao } from '../models/Eleicao';
import {  Cargo} from '../models/Cargo';
import { Escrutinio } from '../models/Escritineo';
import {  Voto } from '../models/Voto';
import { Membro } from '../models/Membro';

export interface CedulaAberta {
  eleicao: Eleicao;
  cargo: Cargo;
  escrutinio: Escrutinio;
}

@Injectable({
  providedIn: 'root'
})
export class VotacaoService {

  private db = inject(Firestore);

  /**
   * 1. Busca a cédula aberta (lendo o documento único)
   */
  async getCedulaAberta(eleicaoId: string): Promise<CedulaAberta | null> {

    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);
    const eleicaoSnap = await getDoc(eleicaoRef);

    if (!eleicaoSnap.exists()) {
      throw new Error('Eleição não encontrada');
    }

    const eleicao = eleicaoSnap.data() as Eleicao;

    if (eleicao.status !== 'em_andamento' || !eleicao.cargoAbertoParaVotacao) {
      return null;
    }

    const { cargoId, escrutinioNum } = eleicao.cargoAbertoParaVotacao;

    const cargo = eleicao.cargos.find(c => c.id === cargoId);
    if (!cargo) {
      return null;
    }

    const escrutinio = cargo.escrutinios.find(
      e => e.numero === escrutinioNum && e.status === 'aberto'
    );
    if (!escrutinio) {
      return null;
    }

    return { eleicao, cargo, escrutinio };
  }

  /**
   * 2. Valida o votante (membro elegível + se já votou)
   * (Recebe a 'CedulaAberta' que já encontramos)
   */
  validarVotante(
    cedula: CedulaAberta,
    eleitorId: string
  ): { valido: boolean; mensagem: string; membro?: Membro } {

    const membroElegivel = cedula.eleicao.membrosElegiveis.find(m => m.id === eleitorId);
    if (!membroElegivel) {
      return { valido: false, mensagem: 'Você não está na lista de votantes para esta eleição.' };
    }

    const jaVotou = cedula.escrutinio.votos.some(v => v.eleitorId === eleitorId);
    if (jaVotou) {
      return { valido: false, mensagem: 'Você já votou neste escrutínio.' };
    }

    return { valido: true, mensagem: 'Votante validado.', membro: membroElegivel };
  }

  /**
   * 3. Registra o Voto (usando transação no documento ÚNICO)
   */
  async registrarVoto(
    eleicaoId: string,
    cargoId: string,
    escrutinioNum: number,
    eleitorId: string,
    candidatoId: string
  ): Promise<void> {

    const eleicaoRef = doc(this.db, 'eleicoes', eleicaoId);

    const novoVoto: Voto = {
      eleitorId: eleitorId,
      candidatoId: candidatoId
    };

    try {
      await runTransaction(this.db, async (transaction) => {

        const eleicaoSnap = await transaction.get(eleicaoRef);
        if (!eleicaoSnap.exists()) {
          throw new Error("Documento da eleição não encontrado!");
        }

        const eleicaoData = eleicaoSnap.data() as Eleicao;

        const novosCargos = eleicaoData.cargos.map(c => ({
          ...c,
          escrutinios: c.escrutinios.map(e => ({...e, votos: [...e.votos]}))
        }));

        const cargoIndex = novosCargos.findIndex(c => c.id === cargoId);
        if (cargoIndex === -1) throw new Error("O cargo não foi encontrado.");

        const escrutinioIndex = novosCargos[cargoIndex].escrutinios.findIndex(
          e => e.numero === escrutinioNum && e.status === 'aberto'
        );
        if (escrutinioIndex === -1) throw new Error("O escrutínio foi fechado durante sua votação.");

        const escrutinioAlvo = novosCargos[cargoIndex].escrutinios[escrutinioIndex];

        const jaVotou = escrutinioAlvo.votos.some(v => v.eleitorId === eleitorId);
        if (jaVotou) throw new Error("Seu voto já foi registrado anteriormente.");

        escrutinioAlvo.votos.push(novoVoto);

        transaction.update(eleicaoRef, {
          cargos: novosCargos
        });
      });

      console.log("Voto registrado com sucesso!");

    } catch (e) {
      console.error("Erro na transação: ", e);
      throw e;
    }
  }
}
