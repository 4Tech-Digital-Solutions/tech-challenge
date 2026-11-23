import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE } from '../nucleo/api';
import {
  AtualizarBeneficiarioPayload,
  Beneficiario,
  BeneficiariosPaginados,
  CriarBeneficiarioPayload,
  FiltrosBeneficiarios
} from './beneficiario';

@Injectable({ providedIn: 'root' })
export class BeneficiarioServico {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  listar(filtros: FiltrosBeneficiarios): Observable<BeneficiariosPaginados> {
    let params = new HttpParams()
      .set('pagina', filtros.pagina)
      .set('tamanho', filtros.tamanho);

    if (filtros.status) {
      params = params.set('status', filtros.status);
    }

    if (filtros.plano_id) {
      params = params.set('plano_id', filtros.plano_id);
    }

    if (filtros.busca?.trim()) {
      params = params.set('busca', filtros.busca.trim());
    }

    return this.http.get<BeneficiariosPaginados>(`${this.base}/beneficiarios`, { params });
  }

  criar(payload: CriarBeneficiarioPayload): Observable<Beneficiario> {
    return this.http.post<Beneficiario>(`${this.base}/beneficiarios`, payload);
  }

  atualizar(id: string, payload: AtualizarBeneficiarioPayload): Observable<Beneficiario> {
    return this.http.put<Beneficiario>(`${this.base}/beneficiarios/${id}`, payload);
  }

  excluir(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/beneficiarios/${id}`);
  }
}
