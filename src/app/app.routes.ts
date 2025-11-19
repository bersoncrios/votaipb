import { Routes } from '@angular/router';
import { AdminComponent } from './demo/layout/admin';
import { EmptyComponent } from './demo/layout/empty';
import { AuthGuard } from './auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: EmptyComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./demo/pages/general-dashboard/general-dashoard.component/general-dashoard.component').then((m) => m.DashboardPublicoComponent)
      },
      {
        path: 'auth',
        loadChildren: () => import('./auth/auth.routes').then((m) => m.routes)
      },
      {
        path: 'votar/:id',
        loadComponent: () => import('./demo/pages/eleicao/votacao.component/votacao.component').then((m) => m.VotacaoComponent)
      },
      {
        path: 'inscrever/:id',
        loadComponent: () => import('./demo/pages/inscricao/inscricao.component/inscricao.component').then((m) => m.InscricaoComponent)
      },
      {
        path: 'dash',
        redirectTo: '',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    component: AdminComponent,
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
        path: 'dashboard',
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'inscricoes/lista',
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/pages/inscricao/admin-listas.component/admin-listas.component').then((m) => m.AdminListasComponent)
      },
      {
        path: 'sobre',
        canActivate: [AuthGuard],
        loadComponent: () => import('./demo/pages/sobre/sobre.component/sobre.component').then((m) => m.SobreComponent)
      }
    ]
  }
];
