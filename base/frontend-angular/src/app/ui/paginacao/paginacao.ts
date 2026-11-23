import { Component, computed, input, output } from '@angular/core';

import { Botao } from '../button';
import { Icone } from '../icon';
import { SELECT_UI } from '../select';

@Component({
  selector: 'app-paginacao',
  imports: [Botao, Icone, SELECT_UI],
  template: `
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3"
    >
      <p class="m-0 text-xs text-slate-500 tabular-nums">
        @if (total() === 0) {
          Nenhum registro
        } @else {
          Mostrando
          <strong class="font-medium text-slate-700">{{ inicioIntervalo() }}–{{ fimIntervalo() }}</strong>
          de
          <strong class="font-medium text-slate-700">{{ total() }}</strong>
        }
      </p>

      <div class="flex flex-wrap items-center gap-4">
        @if (mostrarTamanho()) {
          <div class="flex items-center gap-2">
            <label for="paginacao-tamanho" class="text-xs text-slate-500">Por página</label>
            <div class="w-[74px]">
              <app-select
                inputId="paginacao-tamanho"
                [valor]="'' + tamanho()"
                (valorChange)="aoAlterarTamanho($event)"
              >
                @for (opcao of opcoesTamanho(); track opcao) {
                  <app-select-opcao [valor]="'' + opcao">{{ opcao }}</app-select-opcao>
                }
              </app-select>
            </div>
          </div>
        }

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            appBotao
            variante="secundario"
            tamanho="sm"
            class="h-9 min-w-[96px]"
            [disabled]="paginaSegura() <= 1 || total() === 0 || desabilitado()"
            (click)="paginaChange.emit(paginaSegura() - 1)"
          >
            <app-icone nome="chevron-left" [tamanho]="14" />
            Anterior
          </button>

          <span class="min-w-14 text-center text-xs font-medium text-slate-600 tabular-nums">
            {{ paginaSegura() }} / {{ totalPaginas() }}
          </span>

          <button
            type="button"
            appBotao
            variante="secundario"
            tamanho="sm"
            class="h-9 min-w-[96px]"
            [disabled]="paginaSegura() >= totalPaginas() || total() === 0 || desabilitado()"
            (click)="paginaChange.emit(paginaSegura() + 1)"
          >
            Próxima
            <app-icone nome="chevron-right" [tamanho]="14" />
          </button>
        </div>
      </div>
    </div>
  `
})
export class Paginacao {
  readonly pagina = input.required<number>();
  readonly tamanho = input.required<number>();
  readonly total = input.required<number>();
  readonly opcoesTamanho = input<readonly number[]>([5, 10, 20, 50]);
  readonly mostrarTamanho = input(true);
  readonly desabilitado = input(false);

  readonly paginaChange = output<number>();
  readonly tamanhoChange = output<number>();

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.tamanho()))
  );

  protected readonly paginaSegura = computed(() =>
    Math.min(Math.max(this.pagina(), 1), this.totalPaginas())
  );

  protected readonly inicioIntervalo = computed(() =>
    this.total() === 0 ? 0 : (this.paginaSegura() - 1) * this.tamanho() + 1
  );

  protected readonly fimIntervalo = computed(() =>
    Math.min(this.paginaSegura() * this.tamanho(), this.total())
  );

  protected aoAlterarTamanho(valor: string): void {
    const novo = Number(valor);
    if (novo >= 1 && novo <= 100 && novo !== this.tamanho()) {
      this.tamanhoChange.emit(novo);
    }
  }
}
