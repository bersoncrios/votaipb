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
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ListaInscricao, Inscrito } from '../models/Inscricao';

@Injectable({
  providedIn: 'root'
})
export class ListaInscricaoService {
  private db = inject(Firestore);
  private auth = inject(Auth);


  async criarLista(titulo: string, descricao: string = ''): Promise<string> {
    const user = this.auth.currentUser;
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

  getListasDoAdmin(): Observable<ListaInscricao[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) {
          return of([]);
        }
        const listasRef = collection(this.db, 'listas_inscricao');
        const q = query(listasRef, where('adminUid', '==', user.uid));

        return collectionData(q, { idField: 'id' }) as Observable<ListaInscricao[]>;
      })
    );
  }

  async alternarStatusLista(listaId: string, ativa: boolean): Promise<void> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);
    await updateDoc(listaRef, { ativa });
  }

  getListaPublica(listaId: string): Observable<ListaInscricao | null> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);
    return new Observable(observer => {
      getDoc(listaRef).then(snap => {
        if (snap.exists()) {
          observer.next({ id: snap.id, ...snap.data() } as ListaInscricao);
        } else {
          observer.next(null);
        }
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  async registrarNaLista(listaId: string, nome: string, idUsuario: string): Promise<void> {
    const listaRef = doc(this.db, 'listas_inscricao', listaId);

    try {
      await runTransaction(this.db, async (transaction) => {
        const listaSnap = await transaction.get(listaRef);
        if (!listaSnap.exists()) throw new Error('LISTA_NAO_ENCONTRADA');

        const data = listaSnap.data() as ListaInscricao;

        if (!data.ativa) throw new Error('LISTA_FECHADA');

        const inscritosAtuais = data.inscritos || [];

        if (inscritosAtuais.some(i => i.id === idUsuario)) {
          throw new Error('ID_DUPLICADO');
        }

        const novoInscrito: Inscrito = {
          id: idUsuario.trim(),
          nome: nome.trim(),
          dataRegistro: new Date()
        };

        inscritosAtuais.push(novoInscrito);

        transaction.update(listaRef, { inscritos: inscritosAtuais });
      });
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw error;
    }
  }
}
