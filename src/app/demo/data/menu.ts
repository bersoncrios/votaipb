import { Navigation } from 'src/app/@theme/types/navigation';

export const menus: Navigation[] = [
  {
    id: 'navigation',
    title: 'Navigation',
    type: 'group',
    icon: 'ti ti-menu-2',
    children: [
      {
        id: 'Dashboard',
        title: 'Dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard',
        icon: 'ti ti-home'
      },
        {
        id: 'Registrar Eleições',
        title: 'Registrar Eleições',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/registrar',
        icon: 'ti ti-file-plus'
      },
        {
        id: 'Gerenciar Eleicões',
        title: 'Gerenciar Eleicões',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/lista',
        icon: 'ti ti-adjustments-check'
      }
    ]
  },
];
