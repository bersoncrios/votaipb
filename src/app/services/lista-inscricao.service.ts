import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  getDoc,
  runTransaction,
  query,
  where,
  collectionData,
  serverTimestamp,
  updateDoc
} from '@angular/fire/firestore';
// [IMPORTANTE] Imports reativos do Auth e RxJS
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ListaInscricao, Inscrito } from '../models/Inscricao';

@Injectable({
  providedIn: 'root'
})
export class ListaInscricaoService {
  private db = inject(Firestore);
  private auth = inject(Auth); // Usamos o Auth do @angular/fire

  // --- FUNÇÕES DO ADMIN ---

  /**
   * Cria uma nova lista de inscrição vazia.
   */
  async criarLista(titulo: string, descricao: string = ''): Promise<string> {
    const user = this.auth.currentUser; // Aqui podemos usar o currentUser porque é uma ação instantânea (click)
    if (!user) throw new Error('Precisa estar logado para criar uma lista.');

    const novaLista: Omit<ListaInscricao, 'id'> = {
      adminUid: user.uid,
      titulo: titulo || 'Sem Título',
      descricao: descricao || '',
      ativa: true,
      criadaEm: serverTimestamp(),
      inscritos: []
    };

    const listasRef = collection(this.db, 'listas_inscricao');
    const docRef = await addDoc(listasRef, novaLista);
    return docRef.id;
  }

  /**
   * [CORRIGIDO PARA O ERRO 400]
   * Busca todas as listas criadas pelo admin logado.
   * Agora é reativo e espera o login antes de fazer a consulta.
   */
  getListasDoAdmin(): Observable<ListaInscricao[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        // Se não houver user logado, retorna array vazio (of([]))
        // Isto EVITA a consulta ao Firestore com adminUid=undefined
        if (!user) {
          return of([]);
        }

        // Se tiver user, faz a consulta segura com o uid garantido
        const listasRef = collection(this.db, 'listas_inscricao');
        const q = query(listasRef, where('adminUid', '==', user.uid));

        // Mapeia o ID do documento para o objeto
        return collectionData(q, { idField: 'id' }) as Observable<ListaInscricao[]>;
      })
    );
  }

  /**
   * Fecha ou abre uma lista para novas inscrições.
   */
  async alternarStatusLista(listaId: string, ativa: boolean): Promise<void> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);
    await updateDoc(listaRef, { ativa });
  }

  // --- FUNÇÕES PÚBLICAS (ELEITOR) ---

  /**
   * Busca os dados básicos de uma lista (para mostrar o título na página pública).
   */
  getListaPublica(listaId: string): Observable<ListaInscricao | null> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);
    // Usamos um Observable manual para lidar com 'getDoc' e 'não existe'
    return new Observable(observer => {
       getDoc(listaRef).then(snap => {
         if (snap.exists()) {
           observer.next({ id: snap.id, ...snap.data() } as ListaInscricao);
         } else {
           observer.next(null); // Lista não encontrada
         }
         observer.complete();
       }).catch(err => observer.error(err));
    });
  }

  /**
   * Regista um utilizador numa lista específica (usando transação).
   */
  async registrarNaLista(listaId: string, nome: string, idUsuario: string): Promise<void> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);

    try {
      await runTransaction(this.db, async (transaction) => {
        const listaSnap = await transaction.get(listaRef);
        if (!listaSnap.exists()) throw new Error('LISTA_NAO_ENCONTRADA');

        const data = listaSnap.data() as ListaInscricao;

        if (!data.ativa) throw new Error('LISTA_FECHADA');

        // Garante que 'inscritos' existe
        const inscritosAtuais = data.inscritos || [];

        // Verifica duplicidade de ID
        if (inscritosAtuais.some(i => i.id === idUsuario)) {
          throw new Error('ID_DUPLICADO');
        }

        const novoInscrito: Inscrito = {
          id: idUsuario.trim(),
          nome: nome.trim(),
          dataRegistro: new Date() // O Firestore converte
        };

        inscritosAtuais.push(novoInscrito);

        // Atualiza no banco
        transaction.update(listaRef, { inscritos: inscritosAtuais });
      });
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw error;
    }
  }
}
