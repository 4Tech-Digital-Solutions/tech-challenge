import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';

import { Icone, NomeIcone } from '../icon';
import { ToastItem, ToastServico, VarianteToast } from './toast-servico';

const ICONES: Record<VarianteToast, NomeIcone> = {
  sucesso: 'check-circle',
  erro: 'alert-circle',
  info: 'info',
  aviso: 'alert-circle'
};

const ESTILOS: Record<VarianteToast, { tile: string; barra: string }> = {
  sucesso: {
    tile: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    barra: 'bg-emerald-500'
  },
  erro: {
    tile: 'border-red-200 bg-red-50 text-red-600',
    barra: 'bg-red-500'
  },
  info: {
    tile: 'border-blue-200 bg-blue-50 text-blue-600',
    barra: 'bg-blue-500'
  },
  aviso: {
    tile: 'border-amber-200 bg-amber-50 text-amber-600',
    barra: 'bg-amber-500'
  }
};

@Component({
  selector: 'app-toast-item',
  imports: [Icone],
  template: `
    <li
      class="toast-card pointer-events-auto relative flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-slate-900 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.22)]"
      (mouseenter)="pausar()"
      (mouseleave)="retomar()"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-lg border"
        [class]="estilo().tile"
        aria-hidden="true"
      >
        <app-icone [nome]="icone()" [tamanho]="16" />
      </span>

      <div class="flex min-h-8 min-w-0 flex-1 flex-col justify-center">
        <p class="m-0 text-sm leading-5 font-semibold text-slate-900">
          {{ item().titulo }}
        </p>
        @if (item().descricao) {
          <p class="mt-0.5 mb-0 text-[13px] leading-snug text-slate-500">
            {{ item().descricao }}
          </p>
        }
      </div>

      <button
        type="button"
        class="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
        aria-label="Fechar notificação"
        (click)="fechar()"
      >
        <app-icone nome="x" [tamanho]="12" />
      </button>

      <span
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden="true"
      >
        <span
          class="toast-barra absolute inset-x-0 bottom-0 h-0.5 origin-left"
          [class]="estilo().barra"
          [style.animation-duration.ms]="item().duracaoMs"
          [style.animation-play-state]="pausado() ? 'paused' : 'running'"
        ></span>
      </span>
    </li>
  `,
  styles: `
    @keyframes toast-entrar {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes toast-contagem {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }

    .toast-card {
      animation: toast-entrar 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .toast-barra {
      animation: toast-contagem linear forwards;
    }
  `
})
export class ToastCard implements OnInit, OnDestroy {
  private readonly servico = inject(ToastServico);

  readonly item = input.required<ToastItem>();

  protected readonly pausado = signal(false);
  protected readonly icone = computed(() => ICONES[this.item().variante]);
  protected readonly estilo = computed(() => ESTILOS[this.item().variante]);

  private restanteMs = 0;
  private iniciadoEm = 0;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.restanteMs = this.item().duracaoMs;
    this.agendar();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  protected pausar(): void {
    if (this.pausado()) return;
    this.pausado.set(true);
    clearTimeout(this.timer);
    this.restanteMs = Math.max(0, this.restanteMs - (Date.now() - this.iniciadoEm));
  }

  protected retomar(): void {
    if (!this.pausado()) return;
    this.pausado.set(false);
    this.agendar();
  }

  protected fechar(): void {
    clearTimeout(this.timer);
    this.servico.fechar(this.item().id);
  }

  private agendar(): void {
    this.iniciadoEm = Date.now();
    this.timer = setTimeout(() => this.servico.fechar(this.item().id), this.restanteMs);
  }
}

@Component({
  selector: 'app-toaster',
  imports: [ToastCard],
  template: `
    <ol
      class="pointer-events-none fixed right-6 bottom-6 z-[9999] m-0 flex list-none flex-col items-end gap-3 p-0"
      aria-label="Notificações"
      aria-live="polite"
    >
      @for (item of visiveis(); track item.id) {
        <app-toast-item [item]="item" />
      }
    </ol>
  `
})
export class Toaster {
  private readonly servico = inject(ToastServico);
  protected readonly visiveis = computed(() => this.servico.lista().slice(-3));
}
