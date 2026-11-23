import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { mensagemDeErro } from '../nucleo/api';
import { Botao } from '../ui/button';
import { Icone } from '../ui/icon';
import { TABELA_UI } from '../ui/tabela';
import { Plano } from './plano';
import { PlanoServico } from './plano-servico';

@Component({
  selector: 'app-planos-lista',
  imports: [Botao, Icone, TABELA_UI],
  templateUrl: './planos-lista.html'
})
export class PlanosLista {
  private readonly servico = inject(PlanoServico);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly planos = signal<Plano[]>([]);
  protected readonly carregando = signal(true);
  protected readonly jaCarregou = signal(false);
  protected readonly girandoRefresh = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.carregar();
  }

  protected recarregar(): void {
    this.girandoRefresh.set(true);
    setTimeout(() => this.girandoRefresh.set(false), 450);
    this.carregar();
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    // takeUntilDestroyed cancela a inscrição quando o componente sai da tela.
    // Sem isso, navegar entre rotas vaza subscription.
    this.servico
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (planos) => {
          this.planos.set(planos);
          this.jaCarregou.set(true);
          this.carregando.set(false);
        },
        error: (resposta: HttpErrorResponse) => {
          this.erro.set(mensagemDeErro(resposta));
          this.jaCarregou.set(true);
          this.carregando.set(false);
        }
      });
  }
}
