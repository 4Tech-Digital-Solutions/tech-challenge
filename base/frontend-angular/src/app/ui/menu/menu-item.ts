import { Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';

import { MenuEstado } from './menu';

@Component({
  selector: 'app-menu-item',
  template: `
    @if (visivel()) {
      <button
        type="button"
        role="menuitem"
        class="menu-item"
        [class.ativo]="ativo()"
        [class.perigo]="variante() === 'perigo'"
        [disabled]="desabilitado()"
        (click)="aoClicar()"
      >
        <span class="menu-item-texto"><ng-content /></span>
        @if (ativo()) {
          <span class="menu-item-check" aria-hidden="true">✓</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      width: 100%;
      border: none;
      background: transparent;
      color: #334155;
      border-radius: 7px;
      padding: 0.48rem 0.65rem;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }

    .menu-item:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    .menu-item.ativo {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .menu-item.perigo {
      color: #dc2626;
    }

    .menu-item.perigo:hover:not(:disabled) {
      background: #fef2f2;
      color: #b91c1c;
    }

    .menu-item:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .menu-item-texto {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .menu-item-check {
      font-size: 0.8rem;
      flex-shrink: 0;
    }
  `
})
export class MenuItem {
  private readonly menu = inject(MenuEstado);
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly ativo = input(false);
  readonly variante = input<'padrao' | 'perigo'>('padrao');
  readonly fecharAoClicar = input(true);
  readonly desabilitado = input(false);
  readonly textoBusca = input('');
  readonly ignorarFiltro = input(false);

  readonly escolhido = output<void>();

  protected readonly visivel = computed(() => {
    if (this.ignorarFiltro()) return true;
    const termo = this.menu.filtro().trim().toLowerCase();
    if (!termo) return true;
    const alvo = (this.textoBusca() || this.el.nativeElement.textContent || '').toLowerCase();
    return alvo.includes(termo);
  });

  protected aoClicar(): void {
    if (this.desabilitado()) return;
    this.escolhido.emit();
    if (this.fecharAoClicar()) {
      this.menu.fechar();
    }
  }
}

/**
 * Item de ação destrutiva com confirmação em 2 passos dentro do próprio menu
 * (mesmo padrão do CtxMenuConfirmActionItem).
 */
@Component({
  selector: 'app-menu-confirmar-item',
  template: `
    @if (confirmando()) {
      <div class="confirmar-box">
        <span class="confirmar-texto">{{ textoConfirmacao() }}</span>
        <div class="confirmar-acoes">
          <button
            type="button"
            class="btn-confirmar"
            [disabled]="desabilitado()"
            (click)="confirmar()"
          >
            Confirmar
          </button>
          <button
            type="button"
            class="btn-cancelar"
            [disabled]="desabilitado()"
            (click)="confirmando.set(false)"
          >
            Cancelar
          </button>
        </div>
      </div>
    } @else {
      <button
        type="button"
        role="menuitem"
        class="menu-item perigo"
        [disabled]="desabilitado()"
        (click)="confirmando.set(true)"
      >
        <ng-content />
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .menu-item.perigo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      border: none;
      background: transparent;
      color: #dc2626;
      border-radius: 7px;
      padding: 0.48rem 0.65rem;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
    }

    .menu-item.perigo:hover:not(:disabled) {
      background: #fef2f2;
      color: #b91c1c;
    }

    .confirmar-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.55rem 0.65rem;
      border-radius: 7px;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .confirmar-texto {
      font-size: 0.78rem;
      font-weight: 500;
      color: #991b1b;
    }

    .confirmar-acoes {
      display: flex;
      gap: 0.4rem;
    }

    .btn-confirmar,
    .btn-cancelar {
      flex: 1;
      border-radius: 6px;
      padding: 0.34rem 0.55rem;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease;
    }

    .btn-confirmar {
      border: 1px solid #dc2626;
      background: #dc2626;
      color: #fff;
    }

    .btn-confirmar:hover:not(:disabled) {
      background: #b91c1c;
    }

    .btn-cancelar {
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #334155;
    }

    .btn-cancelar:hover:not(:disabled) {
      background: #f8fafc;
    }
  `
})
export class MenuConfirmarItem {
  private readonly menu = inject(MenuEstado);

  readonly textoConfirmacao = input('Confirmar exclusão?');
  readonly desabilitado = input(false);
  readonly confirmado = output<void>();

  protected readonly confirmando = signal(false);

  constructor() {
    effect(() => {
      if (!this.menu.aberto()) {
        this.confirmando.set(false);
      }
    });
  }

  protected confirmar(): void {
    if (this.desabilitado()) return;
    this.confirmando.set(false);
    this.confirmado.emit();
    this.menu.fechar();
  }
}
