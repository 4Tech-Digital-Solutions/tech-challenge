import { Injectable, signal } from '@angular/core';

export type VarianteToast = 'sucesso' | 'erro' | 'info' | 'aviso';

export interface ToastItem {
  id: number;
  titulo: string;
  descricao?: string;
  variante: VarianteToast;
  duracaoMs: number;
}

export interface NovoToast {
  titulo: string;
  descricao?: string;
  variante?: VarianteToast;
  duracaoMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastServico {
  private proximoId = 1;
  private readonly _lista = signal<ToastItem[]>([]);

  readonly lista = this._lista.asReadonly();

  mostrar(entrada: NovoToast): number {
    const id = this.proximoId++;
    const item: ToastItem = {
      id,
      titulo: entrada.titulo,
      descricao: entrada.descricao,
      variante: entrada.variante ?? 'info',
      duracaoMs: entrada.duracaoMs ?? 4000
    };
    this._lista.update((atual) => [...atual, item]);
    return id;
  }

  sucesso(titulo: string, descricao?: string, duracaoMs?: number): number {
    return this.mostrar({ titulo, descricao, variante: 'sucesso', duracaoMs });
  }

  erro(titulo: string, descricao?: string, duracaoMs = 5500): number {
    return this.mostrar({ titulo, descricao, variante: 'erro', duracaoMs });
  }

  info(titulo: string, descricao?: string, duracaoMs?: number): number {
    return this.mostrar({ titulo, descricao, variante: 'info', duracaoMs });
  }

  aviso(titulo: string, descricao?: string, duracaoMs?: number): number {
    return this.mostrar({ titulo, descricao, variante: 'aviso', duracaoMs });
  }

  fechar(id: number): void {
    this._lista.update((atual) => atual.filter((t) => t.id !== id));
  }
}
