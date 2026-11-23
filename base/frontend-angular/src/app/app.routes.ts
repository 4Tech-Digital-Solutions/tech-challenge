import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./beneficiarios/beneficiarios-lista').then((m) => m.BeneficiariosLista)
  },
  {
    path: 'planos',
    loadComponent: () => import('./planos/planos-lista').then((m) => m.PlanosLista)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
