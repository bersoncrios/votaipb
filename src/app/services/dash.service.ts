import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  where,
  query,
  getCountFromServer,
} from '@angular/fire/firestore';

export interface EleicaoStats {
  total: number;
  agendada: number;
  emAndamento: number;
  finalizada: number;
  desconhecido: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private db = inject(Firestore);

  private eleicoesColRef = collection(this.db, 'eleicoes');

  async getEstatisticasEleicoes(): Promise<EleicaoStats> {

    const queries = {
      total: this.eleicoesColRef,

      agendada: query(
        this.eleicoesColRef,
        where('status', '==', 'agendada')
      ),
      emAndamento: query(
        this.eleicoesColRef,
        where('status', '==', 'em_andamento')
      ),
      finalizada: query(
        this.eleicoesColRef,
        where('status', '==', 'finalizada')
      ),
    };

    try {
      const [
        totalSnap,
        agendadaSnap,
        emAndamentoSnap,
        finalizadaSnap
      ] = await Promise.all([
        getCountFromServer(queries.total),
        getCountFromServer(queries.agendada),
        getCountFromServer(queries.emAndamento),
        getCountFromServer(queries.finalizada),
      ]);

      const total = totalSnap.data().count;
      const agendada = agendadaSnap.data().count;
      const emAndamento = emAndamentoSnap.data().count;
      const finalizada = finalizadaSnap.data().count;

      const somaConhecida = agendada + emAndamento + finalizada;
      const desconhecido = total - somaConhecida;

      if (desconhecido > 0) {
        console.warn(`[DashboardService] Diagnóstico:`);
        console.warn(`- Total de documentos: ${total}`);
        console.warn(`- Soma dos status conhecidos: ${somaConhecida}`);
        console.warn(`- Documentos "Desconhecidos": ${desconhecido}`);
        console.warn(`AÇÃO: Verifique os índices do Firestore para o campo 'status' ou procure por documentos com status nulo/diferente.`);
      }

      return {
        total,
        agendada,
        emAndamento,
        finalizada,
        desconhecido,
      };

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return { total: 0, agendada: 0, emAndamento: 0, finalizada: 0, desconhecido: 0 };
    }
  }
}
