import { Injectable, inject } from '@angular/core';
import {
    Firestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    runTransaction,
    docData,
    query,
    where,
    collectionData
} from '@angular/fire/firestore';
import { EleicaoOficial } from '../models/EleicaoOficial';
import { CargoOficial } from '../models/CargoOficial';
import { VotoOficial } from '../models/VotoOficial';
import { Candidato } from '../models/Candidato';
import { AuthService } from './auth.service';
import { nanoid } from 'nanoid';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EleicaoOficialService {
    private db = inject(Firestore);
    private authService = inject(AuthService);

    async createEleicaoOficial(
        titulo: string,
        membrosElegiveis: any[],
        cargos: { titulo: 'Presbítero' | 'Diácono'; vagas: number; candidatos: Candidato[] }[]
    ): Promise<string> {
        const adminUid = this.authService.getCurrentUserUid();
        if (!adminUid) throw new Error('Usuário não autenticado.');

        const novoId = nanoid(10);
        const eleicaoRef = doc(this.db, 'eleicoes-oficiais', novoId);

        const cargosProcessados: CargoOficial[] = cargos.map(cargo => ({
            id: nanoid(8),
            titulo: cargo.titulo,
            vagas: cargo.vagas,
            candidatos: cargo.candidatos,
            votos: [],
            status: 'aguardando',
            vencedores: []
        }));

        const novaEleicao: EleicaoOficial = {
            id: novoId,
            titulo,
            membrosElegiveis,
            cargos: cargosProcessados,
            status: 'agendada',
            cargoAbertoId: null,
            adminUid
        };

        await setDoc(eleicaoRef, novaEleicao);
        return novoId;
    }

    async updateEleicaoOficial(
        id: string,
        titulo: string,
        membrosElegiveis: any[],
        cargosNovos: { titulo: 'Presbítero' | 'Diácono'; vagas: number; candidatos: Candidato[] }[]
    ): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-oficiais', id);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoOficial;

            if (eleicaoData.status !== 'agendada' && (eleicaoData.status as string) !== 'aguardando') {
                throw new Error('Apenas eleições não iniciadas podem ser alteradas.');
            }


            const cargosProcessados: CargoOficial[] = cargosNovos.map(cn => {
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
                membrosElegiveis,
                cargos: cargosProcessados
            });
        });
    }

    getEleicaoOficial(id: string): Observable<EleicaoOficial> {

        const docRef = doc(this.db, 'eleicoes-oficiais', id);
        return docData(docRef, { idField: 'id' }) as Observable<EleicaoOficial>;
    }

    getEleicoesOficiaisDoAdmin(adminUid: string): Observable<EleicaoOficial[]> {
        const colRef = collection(this.db, 'eleicoes-oficiais');
        const q = query(colRef, where('adminUid', '==', adminUid));
        return collectionData(q, { idField: 'id' }) as Observable<EleicaoOficial[]>;
    }

    async abrirVotacao(eleicaoId: string, cargoId: string): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-oficiais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoOficial;
            const cargos = eleicaoData.cargos;
            const cargoIndex = cargos.findIndex(c => c.id === cargoId);

            if (cargoIndex === -1) throw new Error('Cargo não encontrado.');

            cargos[cargoIndex].status = 'em_votacao';

            transaction.update(eleicaoRef, {
                cargos,
                status: 'em_andamento',
                cargoAbertoId: cargoId
            });
        });
    }

    async registrarVoto(eleicaoId: string, eleitorId: string, candidatosIds: string[]): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-oficiais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoOficial;

            if (!eleicaoData.cargoAbertoId) {
                throw new Error('Nenhum cargo está aberto para votação.');
            }

            const cargo = eleicaoData.cargos.find(c => c.id === eleicaoData.cargoAbertoId);
            if (!cargo) throw new Error('Cargo aberto não encontrado.');

            // Verifica se já votou
            const jaVotou = cargo.votos.some(v => v.eleitorId === eleitorId);
            if (jaVotou) throw new Error('Você já votou neste cargo.');

            // Valida número de candidatos (brancos ou nulos usam 1 ID especial 'BRANCO' ou 'NULO')
            const isVotoEspecial = candidatosIds.length === 1 && (candidatosIds[0] === 'BRANCO' || candidatosIds[0] === 'NULO');
            if (!isVotoEspecial && candidatosIds.length > cargo.vagas) {
                throw new Error(`Você pode selecionar no máximo ${cargo.vagas} candidato(s).`);
            }


            const novoVoto: VotoOficial = {
                eleitorId,
                candidatosIds
            };

            cargo.votos.push(novoVoto);

            transaction.update(eleicaoRef, {
                cargos: eleicaoData.cargos
            });
        });
    }

    async fecharVotacao(eleicaoId: string, cargoId: string): Promise<void> {
        const eleicaoRef = doc(this.db, 'eleicoes-oficiais', eleicaoId);

        await runTransaction(this.db, async (transaction) => {
            const eleicaoSnap = await transaction.get(eleicaoRef);
            if (!eleicaoSnap.exists()) throw new Error('Eleição não encontrada.');

            const eleicaoData = eleicaoSnap.data() as EleicaoOficial;
            const cargo = eleicaoData.cargos.find(c => c.id === cargoId);

            if (!cargo) throw new Error('Cargo não encontrado.');

            // Contagem de votos (Top N)
            const contagemVotos = new Map<string, number>();
            cargo.candidatos.forEach(c => contagemVotos.set(c.userId, 0));

            cargo.votos.forEach(voto => {
                voto.candidatosIds.forEach(candidatoId => {
                    if (contagemVotos.has(candidatoId)) {
                        contagemVotos.set(candidatoId, (contagemVotos.get(candidatoId) || 0) + 1);
                    }
                });
            });

            // Ordenar e pegar Top N
            const resultados = Array.from(contagemVotos.entries())
                .map(([candidatoId, totalVotos]) => ({ candidatoId, totalVotos }))
                .sort((a, b) => b.totalVotos - a.totalVotos);

            const vencedoresIds = resultados.slice(0, cargo.vagas).map(r => r.candidatoId);
            cargo.vencedores = cargo.candidatos.filter(c => vencedoresIds.includes(c.userId));
            cargo.status = 'finalizado';

            // Verifica se todos os cargos estão finalizados
            const todosCargosFinalizados = eleicaoData.cargos.every(c => c.status === 'finalizado');

            transaction.update(eleicaoRef, {
                cargos: eleicaoData.cargos,
                cargoAbertoId: null,
                status: todosCargosFinalizados ? 'finalizada' : 'em_andamento'
            });
        });
    }
}
