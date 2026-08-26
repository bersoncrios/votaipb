import { Injectable, inject } from '@angular/core';
import {
    Firestore,
    collection,
    doc,
    docData,
    setDoc,
    where,
    collectionData,
    query,
    runTransaction
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { nanoid } from 'nanoid';
import { EleicaoPastoral } from '../models/EleicaoPastoral';
import { CargoPastoral } from '../models/CargoPastoral';
import { Candidato } from '../models/Candidato';
import { VotoOficial } from '../models/VotoOficial';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class EleicaoPastoralService {
    private db = inject(Firestore);
    private authService = inject(AuthService);
    private pastoralCollection = collection(this.db, 'eleicoes-pastorais');

    async createEleicaoPastoral(
        titulo: string,
        membrosElegiveis: any[],
        cargosNovos: { titulo: string; vagas: number; candidatos: Candidato[] }[]
    ): Promise<string> {
        const adminUid = this.authService.getCurrentUserUid();
        if (!adminUid) {
            throw new Error('Usuário não autenticado.');
        }

        // Filtra membros elegíveis para garantir que nenhum candidato pastor conste na lista de votantes
        const todosCandidatosIds = new Set<string>();
        cargosNovos.forEach(c => c.candidatos.forEach(cand => todosCandidatosIds.add(cand.userId)));

        const membrosFiltrados = membrosElegiveis.filter(m => !todosCandidatosIds.has(m.id));

        const novoId = nanoid(10);
        const eleicaoRef = doc(this.db, 'eleicoes-pastorais', novoId);

        const cargosProcessados: CargoPastoral[] = cargosNovos.map(cn => ({
            id: nanoid(8),
            titulo: cn.titulo,
            vagas: cn.vagas,
            candidatos: cn.candidatos,
            votos: [],
            status: 'aguardando',
            vencedores: []
        }));

        const novaEleicao: EleicaoPastoral = {
            id: novoId,
            titulo,
            status: 'agendada',
            membrosElegiveis: membrosFiltrados,
            cargos: cargosProcessados,
            cargoAbertoId: null,
            adminUid
        };

        await setDoc(eleicaoRef, novaEleicao);
        return novoId;
    }

    async updateEleicaoPastoral(
        id: string,
        titulo: string,
        membrosElegiveis: any[],
        cargosNovos: { titulo: string; vagas: number; candidatos: Candidato[] }[]
    ): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-pastorais', id);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoPastoral;

            if (eleicaoData.status !== 'agendada' && (eleicaoData.status as string) !== 'aguardando') {
                throw new Error('Apenas eleições não iniciadas podem ser alteradas.');
            }

            const todosCandidatosIds = new Set<string>();
            cargosNovos.forEach(c => c.candidatos.forEach(cand => todosCandidatosIds.add(cand.userId)));
            const membrosFiltrados = membrosElegiveis.filter(m => !todosCandidatosIds.has(m.id));

            const cargosProcessados: CargoPastoral[] = cargosNovos.map(cn => {
                const cargoExistente = eleicaoData.cargos.find(c => c.titulo === cn.titulo);
                return {
                    id: cargoExistente ? cargoExistente.id : nanoid(8),
                    titulo: cn.titulo,
                    vagas: cn.vagas,
                    candidatos: cn.candidatos,
                    votos: cargoExistente ? cargoExistente.votos : [],
                    status: cargoExistente ? cargoExistente.status : 'aguardando',
                    vencedores: cargoExistente ? cargoExistente.vencedores : []
                };
            });

            transaction.update(eleicaoRef, {
                titulo,
                membrosElegiveis: membrosFiltrados,
                cargos: cargosProcessados
            });
        });
    }

    getEleicaoPastoral(id: string): Observable<EleicaoPastoral> {
        const docRef = doc(this.db, 'eleicoes-pastorais', id);
        return docData(docRef, { idField: 'id' }) as Observable<EleicaoPastoral>;
    }

    getEleicoesPastoraisDoAdmin(adminUid: string): Observable<EleicaoPastoral[]> {
        const q = query(this.pastoralCollection, where('adminUid', '==', adminUid));
        return collectionData(q, { idField: 'id' }) as Observable<EleicaoPastoral[]>;
    }

    async abrirVotacao(eleicaoId: string, cargoId: string): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-pastorais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoPastoral;

            if (eleicaoData.cargoAbertoId) {
                throw new Error('Já existe um cargo em votação nesta eleição.');
            }

            const cargoIndex = eleicaoData.cargos.findIndex(c => c.id === cargoId);
            if (cargoIndex === -1) throw new Error('Cargo não encontrado.');

            eleicaoData.cargos[cargoIndex].status = 'em_votacao';

            transaction.update(eleicaoRef, {
                cargos: eleicaoData.cargos,
                cargoAbertoId: cargoId,
                status: 'em_andamento'
            });
        });
    }

    async fecharVotacao(eleicaoId: string, cargoId: string): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-pastorais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoPastoral;

            const cargoIndex = eleicaoData.cargos.findIndex(c => c.id === cargoId);
            if (cargoIndex === -1) throw new Error('Cargo não encontrado.');

            const cargo = eleicaoData.cargos[cargoIndex];
            cargo.status = 'finalizado';

            // Apuração
            const contagemVotos = new Map<string, number>();
            cargo.candidatos.forEach(c => contagemVotos.set(c.userId, 0));

            cargo.votos.forEach(voto => {
                voto.candidatosIds.forEach(candidatoId => {
                    if (contagemVotos.has(candidatoId)) {
                        contagemVotos.set(candidatoId, (contagemVotos.get(candidatoId) || 0) + 1);
                    }
                });
            });

            const resultados = cargo.candidatos.map(c => ({
                candidato: c,
                votos: contagemVotos.get(c.userId) || 0
            })).sort((a, b) => b.votos - a.votos);

            cargo.vencedores = resultados.slice(0, cargo.vagas).map(r => r.candidato);

            const todosFinalizados = eleicaoData.cargos.every(c => c.status === 'finalizado');

            transaction.update(eleicaoRef, {
                cargos: eleicaoData.cargos,
                cargoAbertoId: null,
                status: todosFinalizados ? 'finalizada' : 'em_andamento'
            });
        });
    }

    async registrarVoto(eleicaoId: string, cargoId: string, eleitorId: string, candidatosIds: string[]): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-pastorais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoPastoral;

            // REGRA DE NEGÓCIO PASTORAL: O Pastor Candidato NÃO VOTA
            const ehCandidatoPastor = eleicaoData.cargos.some(cargo =>
                cargo.candidatos.some(c => c.userId.trim().toLowerCase() === eleitorId.trim().toLowerCase())
            );

            if (ehCandidatoPastor) {
                throw new Error('O pastor candidato não possui direito a voto nesta eleição.');
            }

            // Verifica se o eleitor consta na lista de membros elegíveis
            const membroElegivel = eleicaoData.membrosElegiveis.find(m => m.id.trim().toLowerCase() === eleitorId.trim().toLowerCase());
            if (!membroElegivel) {
                throw new Error('Você não está na lista de votantes elegíveis para esta eleição.');
            }

            // Encontra o cargo aberto
            const cargoIndex = eleicaoData.cargos.findIndex(c => c.id === cargoId);
            if (cargoIndex === -1) throw new Error('Cargo não encontrado.');

            const cargo = eleicaoData.cargos[cargoIndex];
            if (cargo.status !== 'em_votacao') {
                throw new Error('A votação para este cargo não está aberta no momento.');
            }

            // Verifica se eleitor já votou
            const jaVotou = cargo.votos.some(v => v.eleitorId.trim().toLowerCase() === eleitorId.trim().toLowerCase());
            if (jaVotou) {
                throw new Error('Seu voto já foi registrado para este cargo.');
            }

            // Adiciona voto
            const novoVoto: VotoOficial = {
                eleitorId: membroElegivel.id,
                candidatosIds
            };

            cargo.votos.push(novoVoto);

            transaction.update(eleicaoRef, {
                cargos: eleicaoData.cargos
            });
        });
    }
}
