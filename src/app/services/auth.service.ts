import { inject, Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup
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
import { Observable, from, BehaviorSubject } from 'rxjs';
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
  public photoURL: string | undefined;
  public role: string | undefined;


  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);
      if (user) {
        this.findData(user.uid);
      } else {
        this.nome = undefined;
        this.photoURL = undefined;
        this.role = undefined;
      }
    });
  }

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

  signInWithGoogle(): Observable<any> {
    const provider = new GoogleAuthProvider();
    return from(
      signInWithPopup(this.auth, provider)
        .then(async (userCredential) => {
          const user = userCredential.user;

          const q = query(collection(this.firestore, 'users'), where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            await addDoc(collection(this.firestore, 'users'), {
              name: user.displayName || '',
              email: user.email || '',
              userId: user.uid,
              role: 'user',
              photoURL: user.photoURL || ''
            }).then((userRef) => {
              updateDoc(doc(this.firestore, 'users', userRef.id), { id: userRef.id });
            });
          }

          return userCredential;
        })
        .catch(error => {
          let errorMessage = 'Erro ao fazer login com Google';

          if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Login cancelado';
          } else if (error.code === 'auth/popup-blocked') {
            errorMessage = 'Popup bloqueado pelo navegador';
          } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Solicitação de login cancelada';
          }

          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: errorMessage
          });

          return { error };
        })
    );
  }

  linkGoogleAccount(): Observable<any> {
    const provider = new GoogleAuthProvider();
    const currentUser = this.auth.currentUser;

    if (!currentUser) {
      return from(Promise.reject({ error: 'Nenhum usuário logado' }));
    }

    return from(
      linkWithPopup(currentUser, provider)
        .then(async (result) => {
          const user = result.user;

          const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
          const photoURL = googleProvider?.photoURL || user.photoURL || '';

          const q = query(
            collection(this.firestore, 'users'),
            where('userId', '==', user.uid)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDocRef = doc(this.firestore, 'users', querySnapshot.docs[0].id);
            await updateDoc(userDocRef, {
              photoURL: photoURL
            });

            this.photoURL = photoURL || undefined;

            await this.findData(user.uid);
          }

          return result;
        })
        .catch(error => {
          let errorMessage = 'Erro ao vincular conta Google';

          if (error.code === 'auth/provider-already-linked') {
            errorMessage = 'Conta Google já vinculada';
          } else if (error.code === 'auth/credential-already-in-use') {
            errorMessage = 'Esta conta Google já está sendo usada por outro usuário';
          } else if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Vinculação cancelada';
          }

          Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: errorMessage
          });

          return { error };
        })
    );
  }

  signup(params: SignUp): Observable<any> {
    return from(createUserWithEmailAndPassword(this.auth, params.email, params.password));
  }

  logout(): void {
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

  async findData(uid: string): Promise<string | null> {
    const q = query(collection(this.firestore, 'users'), where('userId', '==', uid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0].data() as SignUp;
      this.nome = userDoc.name;
      this.photoURL = userDoc.photoURL;
      this.role = userDoc.role;
      return this.nome;
    }
    return null;
  }
}
