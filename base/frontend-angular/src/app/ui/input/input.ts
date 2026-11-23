import { Component, Directive, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type TipoMascara = 'cpf' | 'data';

const INPUT_BASE =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'transition-colors focus:outline-none focus:ring-3 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

@Component({
  selector: 'app-campo',
  template: `
    <div class="flex flex-col gap-1.5">
      @if (rotulo()) {
        <label
          [attr.for]="para() || null"
          [class]="
            compacto()
              ? 'text-xs font-medium text-slate-500'
              : 'text-sm font-medium text-slate-700'
          "
        >
          {{ rotulo() }}
        </label>
      }

      <ng-content />

      @if (erro()) {
        <span class="text-xs text-red-700" role="alert">{{ erro() }}</span>
      } @else if (dica()) {
        <span class="text-xs text-slate-500">{{ dica() }}</span>
      }
    </div>
  `
})
export class Campo {
  readonly rotulo = input('');
  readonly para = input('');
  readonly erro = input<string | null>(null);
  readonly dica = input('');
  readonly compacto = input(false);
}

@Directive({
  selector: 'input[appInput]',
  host: {
    '[class]': 'classes()'
  }
})
export class InputDirective {
  readonly invalido = input(false);

  protected readonly classes = computed(() =>
    this.invalido()
      ? `${INPUT_BASE} border-red-400 focus:border-red-500 focus:ring-red-500/15`
      : `${INPUT_BASE} border-slate-300 focus:border-blue-600 focus:ring-blue-600/15`
  );
}

function aplicarMascaraCpf(digitos: string): string {
  const d = digitos.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function aplicarMascaraData(digitos: string): string {
  const d = digitos.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function isoParaMascaraData(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function digitosDataParaIso(digitos: string): string {
  if (digitos.length === 0) return '';
  if (digitos.length < 8) return digitos;

  const dia = Number(digitos.slice(0, 2));
  const mes = Number(digitos.slice(2, 4));
  const ano = Number(digitos.slice(4, 8));

  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return 'invalida';
  }

  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return 'invalida';
  }

  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Input de texto com máscara visual (CPF: 000.000.000-00 | Data: DD/MM/AAAA)
 * que mantém no FormControl o formato puro exigido pela API (11 dígitos | YYYY-MM-DD).
 */
@Component({
  selector: 'app-input-mascara',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputMascara),
      multi: true
    }
  ],
  template: `
    <input
      type="text"
      inputmode="numeric"
      [id]="inputId() || null"
      [placeholder]="placeholderResolvido()"
      [maxLength]="maxLength()"
      [disabled]="desabilitado()"
      [value]="valorVisual()"
      [class]="classes()"
      (input)="aoDigitar($event)"
      (blur)="aoSair()"
    />
  `
})
export class InputMascara implements ControlValueAccessor {
  readonly mascara = input.required<TipoMascara>();
  readonly inputId = input('');
  readonly placeholder = input('');
  readonly invalido = input(false);

  protected readonly valorVisual = signal('');
  protected readonly desabilitado = signal(false);

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly maxLength = computed(() => (this.mascara() === 'cpf' ? 14 : 10));
  protected readonly placeholderResolvido = computed(() => {
    if (this.placeholder()) return this.placeholder();
    return this.mascara() === 'cpf' ? '000.000.000-00' : 'DD/MM/AAAA';
  });

  protected readonly classes = computed(() =>
    this.invalido()
      ? `${INPUT_BASE} border-red-400 focus:border-red-500 focus:ring-red-500/15`
      : `${INPUT_BASE} border-slate-300 focus:border-blue-600 focus:ring-blue-600/15`
  );

  protected aoDigitar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitos = input.value.replace(/\D/g, '');

    if (this.mascara() === 'cpf') {
      const limpo = digitos.slice(0, 11);
      const formatado = aplicarMascaraCpf(limpo);
      this.valorVisual.set(formatado);
      input.value = formatado;
      this.onChange(limpo);
      return;
    }

    const limpo = digitos.slice(0, 8);
    const formatado = aplicarMascaraData(limpo);
    this.valorVisual.set(formatado);
    input.value = formatado;
    this.onChange(digitosDataParaIso(limpo));
  }

  protected aoSair(): void {
    this.onTouched();
  }

  writeValue(valor: string | null): void {
    const texto = valor ?? '';
    if (!texto) {
      this.valorVisual.set('');
      return;
    }

    if (this.mascara() === 'cpf') {
      this.valorVisual.set(aplicarMascaraCpf(texto.replace(/\D/g, '')));
    } else {
      this.valorVisual.set(isoParaMascaraData(texto));
    }
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.desabilitado.set(isDisabled);
  }
}
