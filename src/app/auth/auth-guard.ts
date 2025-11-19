import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged } from 'firebase/auth';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(Auth);

  const user = await new Promise<any>((resolve) => {
    onAuthStateChanged(auth, (u) => resolve(u));
  });

  if (user) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};
