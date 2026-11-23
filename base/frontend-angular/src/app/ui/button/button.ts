import { Directive, computed, input } from '@angular/core';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'link';
export type TamanhoBotao = 'sm' | 'md' | 'icone';

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-xs',
  secundario: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
  perigo: 'border border-red-600 bg-red-600 text-white hover:bg-red-700 shadow-xs',
  fantasma: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  link: 'border border-transparent bg-transparent text-blue-600 hover:underline px-1'
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  icone: 'size-9 p-0 text-base'
};

@Directive({
  selector: 'button[appBotao], a[appBotao]',
  host: {
    '[class]': 'classes()'
  }
})
export class Botao {
  readonly variante = input<VarianteBotao>('secundario');
  readonly tamanho = input<TamanhoBotao>('md');

  protected readonly classes = computed(
    () => `${BASE} ${VARIANTES[this.variante()]} ${TAMANHOS[this.tamanho()]}`
  );
}
