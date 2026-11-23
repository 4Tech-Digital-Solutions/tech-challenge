import { Component, Directive, ElementRef, Injectable, effect, inject, input, signal } from '@angular/core';

/**
 * Estado compartilhado via DI hierárquica (equivalente ao ContextMenuContext do React).
 * Tanto <app-menu> quanto <app-select> proveem sua própria instância em `providers: [MenuEstado]`.
 */
@Injectable()
export class MenuEstado {
  readonly alinhamento = signal<'esquerda' | 'direita'>('esquerda');
  readonly larguraIgualTrigger = signal(false);

  readonly aberto = signal(false);
  readonly filtro = signal('');
  readonly triggerEl = signal<HTMLElement | null>(null);

  abrir(el: HTMLElement): void {
    this.triggerEl.set(el);
    this.filtro.set('');
    this.aberto.set(true);
  }

  fechar(): void {
    if (!this.aberto()) return;
    this.aberto.set(false);
    this.filtro.set('');
  }

  alternar(el: HTMLElement): void {
    if (this.aberto()) {
      this.fechar();
    } else {
      this.abrir(el);
    }
  }
}

@Component({
  selector: 'app-menu',
  providers: [MenuEstado],
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-block;
      position: relative;
    }
  `
})
export class MenuContexto {
  readonly estado = inject(MenuEstado);
  readonly alinhamento = input<'esquerda' | 'direita'>('esquerda');
  readonly larguraIgualTrigger = input(false);

  constructor() {
    effect(() => {
      this.estado.alinhamento.set(this.alinhamento());
      this.estado.larguraIgualTrigger.set(this.larguraIgualTrigger());
    });
  }
}

/**
 * Equivalente Angular do TriggerArea (React):
 * gruda eventos e atributos ARIA direto no elemento hospedeiro sem criar wrapper no DOM.
 */
@Directive({
  selector: '[appMenuTrigger]',
  host: {
    '(click)': 'aoClicar($event)',
    '[attr.aria-haspopup]': "'menu'",
    '[attr.aria-expanded]': 'menu.aberto()'
  }
})
export class MenuTrigger {
  protected readonly menu = inject(MenuEstado);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected aoClicar(event: MouseEvent): void {
    event.stopPropagation();
    const alvo = this.el.nativeElement;
    if ((alvo as HTMLButtonElement).disabled) return;
    this.menu.alternar(alvo);
  }
}

@Component({
  selector: 'app-menu-separador',
  template: '',
  styles: `
    :host {
      display: block;
      height: 1px;
      margin: 0.25rem 0;
      background: #e2e8f0;
    }
  `
})
export class MenuSeparador {}
