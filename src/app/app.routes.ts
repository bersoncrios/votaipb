import { Routes } from '@angular/router';
import { AdminComponent } from './demo/layout/admin';
import { EmptyComponent } from './demo/layout/empty';
import { AuthGuard } from './auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: EmptyComponent, // Layout "vazio" (sem menu de admin) para páginas públicas
    children: [
      // --- MUDANÇA AQUI ---
      // 1. A rota raiz ('') agora carrega a Landing Page (DashboardPublicoComponent)
      {
        path: '',
        loadComponent: () => import('./demo/pages/general-dashboard/general-dashoard.component/general-dashoard.component').then((m) => m.DashboardPublicoComponent)
      },
      // 2. A rota 'auth' continua carregando os filhos de autenticação (login, register, etc.)
      {
        path: 'auth',
        loadChildren: () => import('./auth/auth.routes').then((m) => m.routes)
      },
      // 3. As outras rotas públicas continuam iguais
      {
        path: 'votar/:id',
        loadComponent: () => import('./demo/pages/eleicao/votacao.component/votacao.component').then((m) => m.VotacaoComponent)
      },
       {
        path: 'inscrever/:id',
        loadComponent: () => import('./demo/pages/inscricao/inscricao.component/inscricao.component').then((m) => m.InscricaoComponent)
      },
      // 4. (Opcional) Se você ainda quiser que /dash funcione, pode redirecionar para a raiz.
      {
        path: 'dash',
        redirectTo: '',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    component: AdminComponent, // Layout "admin" (com menu) para páginas privadas
    children: [
      {
        path: 'eleicoes/registrar',
        canActivate: [AuthGuard],
        loadComponent: () =>
          import('./demo/pages/eleicao/register-election.component/register-election.component').then((m) => m.RegisterElectionComponent)
      },
      {
        path: 'eleicoes/gerenciar/:id',
        canActivate: [AuthGuard],
        loadComponent: () =>
          import('./demo/pages/eleicao/election-manager.component/election-manager.component').then((m) => m.EleicaoManageComponent)
      },
      {
        path: 'eleicoes/lista',
        canActivate: [AuthGuard],
        loadComponent: () =>
          import('./demo/pages/eleicao/election-list.component/election-list.component').then((m) => m.EleicaoListComponent)
      },
      {
        path: 'dashboard', // Este é o dashboard *privado* do admin
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'inscricoes/lista',
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/pages/inscricao/admin-listas.component/admin-listas.component').then((m) => m.AdminListasComponent)
      }
    ]
  }
];
