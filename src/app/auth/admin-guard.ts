import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export const AdminGuard: CanActivateFn = async () => {
    const router = inject(Router);
    const auth = inject(Auth);
    const firestore = inject(Firestore);

    // Primeiro verifica se está autenticado
    const user = await new Promise<any>((resolve) => {
        onAuthStateChanged(auth, (u) => resolve(u));
    });

    console.log('[AdminGuard] User:', user?.uid);

    if (!user) {
        console.log('[AdminGuard] Usuário não autenticado');
        router.navigate(['/auth/login']);
        return false;
    }

    // Busca o documento do usuário para verificar a role
    try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        console.log('[AdminGuard] Documentos encontrados:', querySnapshot.size);

        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            console.log('[AdminGuard] Role do usuário:', userData['role']);

            if (userData['role'] === 'admin') {
                console.log('[AdminGuard] Acesso permitido - usuário é admin');
                return true;
            }
        }

        // Usuário não é admin - redireciona para dashboard
        console.log('[AdminGuard] Acesso negado - usuário não é admin');
        router.navigate(['/dashboard']);
        return false;
    } catch (error) {
        console.error('[AdminGuard] Erro ao verificar role:', error);
        router.navigate(['/dashboard']);
        return false;
    }
};
