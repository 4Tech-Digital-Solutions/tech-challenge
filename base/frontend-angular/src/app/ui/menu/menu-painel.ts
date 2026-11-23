import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';

import { MenuEstado } from './menu';

interface PosicaoPainel {
  top: number;
  left: number | null;
  right: number | null;
  minWidth: number;
}

@Component({
  selector: 'app-menu-painel',
  host: {
    '(document:pointerdown)': 'aoClicarFora($event)',
    '(document:keydown.escape)': 'aoPressionarEsc()',
    '(window:resize)': 'aoRedimensionar()',
    '(window:scroll)': 'aoRolar($event)'
  },
  template: `
    <div
      #painelEl
      class="menu-painel"
      role="menu"
      [hidden]="!menu.aberto()"
      [style.top.px]="posicao().top"
      [style.left.px]="posicao().left"
      [style.right.px]="posicao().right"
      [style.min-width.px]="posicao().minWidth"
      (click)="$event.stopPropagation()"
    >
      @if (rotulo()) {
        <div class="menu-rotulo">{{ rotulo() }}</div>
      }

      @if (pesquisavel()) {
        <div class="menu-busca-box">
          <input
            #buscaInput
            type="text"
            class="menu-busca"
            [value]="menu.filtro()"
            [placeholder]="placeholderBusca()"
            (input)="aoDigitarBusca($event)"
            aria-label="Filtrar opções"
          />
        </div>
      }

      <div class="menu-lista">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .menu-painel {
      position: fixed;
      z-index: 100;
      max-width: min(360px, calc(100vw - 16px));
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow:
        0 10px 30px -5px rgba(15, 23, 42, 0.12),
        0 4px 10px -2px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }

    .menu-painel[hidden] {
      display: none;
    }

    .menu-rotulo {
      padding: 0.5rem 0.75rem 0.4rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: #64748b;
      border-bottom: 1px solid #f1f5f9;
    }

    .menu-busca-box {
      padding: 0.45rem;
      border-bottom: 1px solid #f1f5f9;
      background: #f8fafc;
    }

    .menu-busca {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 0.38rem 0.6rem;
      font: inherit;
      font-size: 0.84rem;
      color: #0f172a;
      background: #fff;
    }

    .menu-busca:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
    }

    .menu-lista {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0.35rem;
      max-height: 260px;
      overflow-y: auto;
    }
  `
})
export class MenuPainel {
  protected readonly menu = inject(MenuEstado);
  private readonly painelEl = viewChild<ElementRef<HTMLElement>>('painelEl');
  private readonly buscaInput = viewChild<ElementRef<HTMLInputElement>>('buscaInput');

  readonly rotulo = input('');
  readonly pesquisavel = input(false);
  readonly placeholderBusca = input('Filtrar...');

  protected readonly posicao = signal<PosicaoPainel>({
    top: 0,
    left: 0,
    right: null,
    minWidth: 184
  });

  constructor() {
    effect(() => {
      if (!this.menu.aberto()) return;

      this.atualizarPosicao();

      if (this.pesquisavel()) {
        queueMicrotask(() => this.buscaInput()?.nativeElement.focus());
      }
    });
  }

  protected aoDigitarBusca(event: Event): void {
    this.menu.filtro.set((event.target as HTMLInputElement).value);
  }

  protected aoClicarFora(event: PointerEvent): void {
    if (!this.menu.aberto()) return;
    const alvo = event.target as Node | null;
    const painel = this.painelEl()?.nativeElement;
    const trigger = this.menu.triggerEl();

    if (alvo && (painel?.contains(alvo) || trigger?.contains(alvo))) {
      return;
    }

    this.menu.fechar();
  }

  protected aoPressionarEsc(): void {
    if (this.menu.aberto()) {
      this.menu.fechar();
    }
  }

  protected aoRedimensionar(): void {
    if (this.menu.aberto()) {
      this.menu.fechar();
    }
  }

  protected aoRolar(event: Event): void {
    if (!this.menu.aberto()) return;
    const alvo = event.target as Node | null;
    const painel = this.painelEl()?.nativeElement;
    if (painel && alvo && painel.contains(alvo)) {
      return;
    }
    this.menu.fechar();
  }

  private atualizarPosicao(): void {
    const trigger = this.menu.triggerEl();
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const alturaEstimada = 220;
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const abrirAcima = espacoAbaixo < alturaEstimada && rect.top > alturaEstimada;

    const minWidth = this.menu.larguraIgualTrigger() ? Math.max(rect.width, 160) : 184;
    const top = abrirAcima ? Math.max(8, rect.top - alturaEstimada) : rect.bottom + 6;

    if (this.menu.alinhamento() === 'direita') {
      const right = Math.max(8, window.innerWidth - rect.right);
      this.posicao.set({ top, left: null, right, minWidth });
    } else {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8));
      this.posicao.set({ top, left, right: null, minWidth });
    }
  }
}
