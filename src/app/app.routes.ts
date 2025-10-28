// src/app/app.routes.ts
import { Routes } from '@angular/router';

// Layouts
import { AdminComponent } from './demo/layout/admin';
import { EmptyComponent } from './demo/layout/empty';
import { AuthGuard } from './auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    component: EmptyComponent,
    children: [
      { path: '', redirectTo: 'auth', pathMatch: 'full' },
      {
        path: 'auth',
        loadChildren: () =>
          import('./auth/auth.routes').then(m => m.routes)
      },{
  path: 'votar/:id',
  loadComponent: () =>
    import('./demo/pages/eleicao/votacao.component/votacao.component').then(m => m.VotacaoComponent)
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
          import('./demo/pages/eleicao/register-election.component/register-election.component').then(m => m.RegisterElectionComponent)
      },
       {
        path: 'eleicoes/gerenciar/:id',
        canActivate: [AuthGuard],
        loadComponent: () =>
          import('./demo/pages/eleicao/election-manager.component/election-manager.component').then(m => m.EleicaoManageComponent)
      },
{
    path: 'eleicoes/lista',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./demo/pages/eleicao/election-list.component/election-list.component').then(m => m.EleicaoListComponent)
  },
      {
        path: 'dashboard',
        canActivate: [AuthGuard],
        loadComponent: () =>
          import('./demo/pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  }
];
