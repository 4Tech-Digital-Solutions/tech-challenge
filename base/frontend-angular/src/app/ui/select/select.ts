import {
  AfterViewInit,
  Component,
  ElementRef,
  Injectable,
  computed,
  contentChildren,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Icone } from '../icon';
import { MenuEstado, MenuItem, MenuPainel, MenuTrigger } from '../menu';

@Injectable()
export class SelectEstado {
  readonly valorAtual = signal('');
  private aoSelecionar: (valor: string) => void = () => {};

  registrarSelecao(fn: (valor: string) => void): void {
    this.aoSelecionar = fn;
  }

  selecionar(novoValor: string): void {
    this.aoSelecionar(novoValor);
  }
}

@Component({
  selector: 'app-select-opcao',
  imports: [MenuItem],
  template: `
    <app-menu-item
      [ativo]="ativo()"
      [desabilitado]="desabilitado()"
      [textoBusca]="textoBuscaResolvido()"
      (escolhido)="aoEscolher()"
    >
      <ng-content />
    </app-menu-item>
  `,
  styles: `
    :host {
      display: contents;
    }
  `
})
export class SelectOpcao implements AfterViewInit {
  private readonly estado = inject(SelectEstado);
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly valor = input.required<string>();
  readonly rotulo = input('');
  readonly desabilitado = input(false);

  private readonly textoDom = signal('');

  readonly textoExibicao = computed(() => this.rotulo() || this.textoDom());
  protected readonly textoBuscaResolvido = computed(() =>
    `${this.rotulo()} ${this.textoDom()}`.trim()
  );
  protected readonly ativo = computed(() => this.estado.valorAtual() === this.valor());

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.textoDom.set((this.el.nativeElement.textContent ?? '').replace('✓', '').trim());
    });
  }

  protected aoEscolher(): void {
    this.estado.selecionar(this.valor());
  }
}

@Component({
  selector: 'app-select',
  imports: [Icone, MenuTrigger, MenuPainel],
  providers: [
    MenuEstado,
    SelectEstado,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true
    }
  ],
  template: `
    <button
      type="button"
      appMenuTrigger
      class="select-gatilho"
      [class.aberto]="menu.aberto()"
      [class.placeholder]="!rotuloSelecionado()"
      [id]="inputId() || null"
      [disabled]="estaDesabilitado()"
    >
      <span class="select-valor">{{ rotuloSelecionado() || placeholder() }}</span>
      <app-icone nome="chevron-down" [tamanho]="14" class="select-seta" />
    </button>

    <app-menu-painel [pesquisavel]="pesquisavel()" [placeholderBusca]="placeholderBusca()">
      <ng-content />
    </app-menu-painel>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }

    .select-gatilho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 8px;
      padding: 0.5rem 0.72rem;
      font: inherit;
      font-size: 0.875rem;
      color: #0f172a;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .select-gatilho:hover:not(:disabled) {
      border-color: #94a3b8;
    }

    .select-gatilho:focus,
    .select-gatilho.aberto {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }

    .select-gatilho:disabled {
      background: #f1f5f9;
      color: #64748b;
      cursor: not-allowed;
    }

    .select-gatilho.placeholder .select-valor {
      color: #64748b;
    }

    .select-valor {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .select-seta {
      color: #64748b;
      font-size: 0.78rem;
      flex-shrink: 0;
      transition: transform 0.15s;
    }

    .select-gatilho.aberto .select-seta {
      transform: rotate(180deg);
    }
  `
})
export class Select implements ControlValueAccessor {
  protected readonly menu = inject(MenuEstado);
  private readonly estado = inject(SelectEstado);
  private readonly opcoes = contentChildren(SelectOpcao, { descendants: true });

  readonly inputId = input('');
  readonly valor = input<string | undefined>(undefined);
  readonly placeholder = input('Selecione...');
  readonly pesquisavel = input(false);
  readonly placeholderBusca = input('Filtrar opções...');
  readonly desabilitado = input(false);

  readonly valorChange = output<string>();

  private readonly valorInterno = signal('');
  private readonly desabilitadoCva = signal(false);
  private foiAberto = false;

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly valorAtual = computed(() =>
    this.valor() !== undefined ? this.valor()! : this.valorInterno()
  );

  protected readonly estaDesabilitado = computed(
    () => this.desabilitado() || this.desabilitadoCva()
  );

  protected readonly rotuloSelecionado = computed(() => {
    const atual = this.valorAtual();
    const encontrada = this.opcoes().find((opcao) => opcao.valor() === atual);
    return encontrada ? encontrada.textoExibicao() : '';
  });

  constructor() {
    this.menu.larguraIgualTrigger.set(true);
    this.estado.registrarSelecao((novoValor) => this.selecionar(novoValor));

    effect(() => {
      this.estado.valorAtual.set(this.valorAtual());
    });

    effect(() => {
      const aberto = this.menu.aberto();
      if (aberto) {
        this.foiAberto = true;
      } else if (this.foiAberto) {
        this.foiAberto = false;
        this.onTouched();
      }
    });
  }

  selecionar(novoValor: string): void {
    this.valorInterno.set(novoValor);
    this.onChange(novoValor);
    this.onTouched();
    this.valorChange.emit(novoValor);
  }

  writeValue(valor: string | null): void {
    this.valorInterno.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.desabilitadoCva.set(isDisabled);
  }
}
