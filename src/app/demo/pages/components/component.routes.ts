// src/app/demo/pages/components/component.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'typography',
        loadComponent: () =>
          import('./typography/typography.component').then(m => m.TypographyComponent)
      },
      {
        path: 'color',
        loadComponent: () =>
          import('./color/color.component').then(m => m.ColorComponent)
      }
    ]
  }
];
