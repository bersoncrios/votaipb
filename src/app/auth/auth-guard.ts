import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { getIdTokenResult, onAuthStateChanged } from 'firebase/auth';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(Auth);

  const uid = sessionStorage.getItem('uid');
  const token = sessionStorage.getItem('token');

  if (!uid || !token) {
    router.navigate(['/auth/login']);
    return false;
  }

  const user = await new Promise<any>((resolve) => {
    onAuthStateChanged(auth, (u) => resolve(u));
  });

  if (user) {
    const tokenResult = await getIdTokenResult(user);

    // compara expiração
    const exp = tokenResult.expirationTime
      ? new Date(tokenResult.expirationTime).getTime()
      : 0;

    if (Date.now() < exp) {
      return true; // ✅ token válido
    } else {
      sessionStorage.clear();
      router.navigate(['/auth/login']);
      return false; // ❌ token expirado
    }
  }

  sessionStorage.clear();
  router.navigate(['/auth/login']);
  return false;
};
