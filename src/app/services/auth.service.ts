import { inject, Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged, // <<< 1. IMPORTADO
  User                  // <<< 2. IMPORTADO
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, from, BehaviorSubject } from 'rxjs'; // <<< 3. IMPORTADO
import Swal from 'sweetalert2';
import { SignIn } from 'src/app/models/UserSignIn';
import { SignUp } from 'src/app/models/UserSignUp';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);
  public nome: string | undefined;


  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);
      if (user) {
        this.findData(user.uid);
      } else {
        this.nome = undefined;
      }
    });
  }

  /**
   * Obtém o UID do usuário logado de forma síncrona.
   * Isto é o que o EleicaoAdminService usará.
   */
  public getCurrentUserUid(): string | null {
    return this.currentUserSubject.value?.uid || null;
  }

  signin(params: SignIn): Observable<any> {
    return from(
      signInWithEmailAndPassword(this.auth, params.email, params.password)
        .then(userCredential => userCredential)
        .catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text:
              error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found'
                ? 'Email ou senha incorretos'
                : 'Erro ao fazer login, tente novamente'
          });
          return { error };
        })
    );
  }

  signup(params: SignUp): Observable<any> {
    return from(createUserWithEmailAndPassword(this.auth, params.email, params.password));
  }

  logout(): void {
    sessionStorage.removeItem('token');
    this.auth.signOut();
    this.router.navigate(['/auth/login']);
  }

  resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  async createData(params: SignUp): Promise<void> {
    const userRef = await addDoc(collection(this.firestore, 'users'), {
      name: params.name,
      email: params.email,
      userId: params.userId || '',
      role: params.role || ''
    });
    await updateDoc(doc(this.firestore, 'users', userRef.id), { id: userRef.id });
  }

  /**
   * Busca os dados do usuário e atualiza a propriedade 'nome'.
   * Agora é chamado pelo 'onAuthStateChanged' no constructor.
   */
  async findData(uid: string): Promise<string | null> {
    // Não usa 'this.auth.currentUser' para evitar race conditions
    const q = query(collection(this.firestore, 'users'), where('userId', '==', uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0].data() as SignUp;
      this.nome = userDoc.name;
      return this.nome;
    }
    return null;
  }
}
