import { Navigation } from 'src/app/@theme/types/navigation';

export const menus: Navigation[] = [
  {
    id: 'navigation',
    title: '',
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
        id: 'Sobre',
        title: 'Sobre',
        type: 'item',
        classes: 'nav-item',
        url: '/sobre',
        icon: 'ti ti-info-square-rounded'
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
      },
        {
        id: 'Gerenciar Inscrições',
        title: 'Gerenciar Inscrições',
        type: 'item',
        classes: 'nav-item',
        url: '/inscricoes/lista',
        icon: 'ti ti-list-details'
      }
    ]
  },
];
