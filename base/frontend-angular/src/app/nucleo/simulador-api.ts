import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { switchMap, throwError, timer } from 'rxjs';

/**
 * Estado em memória para demonstrar estados de carregamento e erro da API.
 * Nunca persiste em localStorage/cookie: recarregar a página sempre volta ao normal.
 */
@Injectable({ providedIn: 'root' })
export class SimuladorApi {
  readonly atrasoMs = signal(0);
  readonly forcarErro = signal(false);
  readonly versaoDados = signal(0);

  readonly ativo = computed(() => this.atrasoMs() > 0 || this.forcarErro());

  notificarDadosAtualizados(): void {
    this.versaoDados.update((v) => v + 1);
  }

  definirAtraso(ms: number): void {
    const seguro = Number.isFinite(ms) ? Math.min(10000, Math.max(0, Math.round(ms))) : 0;
    this.atrasoMs.set(seguro);
  }

  definirForcarErro(ativo: boolean): void {
    this.forcarErro.set(ativo);
  }

  resetar(): void {
    this.atrasoMs.set(0);
    this.forcarErro.set(false);
  }
}

export const simuladorApiInterceptor: HttpInterceptorFn = (req, next) => {
  const simulador = inject(SimuladorApi);
  const atraso = simulador.atrasoMs();
  const forcarErro = simulador.forcarErro();

  if (!forcarErro && atraso === 0) {
    return next(req);
  }

  if (forcarErro) {
    return timer(atraso).pipe(
      switchMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 503,
              statusText: 'Service Unavailable',
              url: req.url,
              error: {
                erro: 'ErroSimulado',
                mensagem: 'Erro simulado na API (modo demo ativo).',
                detalhes: []
              }
            })
        )
      )
    );
  }

  return timer(atraso).pipe(switchMap(() => next(req)));
};
