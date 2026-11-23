import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { mensagemDeErro } from '../nucleo/api';
import { SimuladorApi } from '../nucleo/simulador-api';
import { Plano } from '../planos/plano';
import { PlanoServico } from '../planos/plano-servico';
import { Botao } from '../ui/button';
import { Icone } from '../ui/icon';
import { MENU_UI } from '../ui/menu';
import { Paginacao } from '../ui/paginacao';
import { SELECT_UI } from '../ui/select';
import { TABELA_UI } from '../ui/tabela';
import { ToastServico } from '../ui/toast';
import {
  Beneficiario,
  StatusBeneficiario,
  formatarCpf,
  formatarData
} from './beneficiario';
import { BeneficiarioForm } from './beneficiario-form';
import { BeneficiarioServico } from './beneficiario-servico';

@Component({
  selector: 'app-beneficiarios-lista',
  imports: [BeneficiarioForm, Botao, Icone, MENU_UI, Paginacao, SELECT_UI, TABELA_UI],
  templateUrl: './beneficiarios-lista.html'
})
export class BeneficiariosLista {
  private readonly servico = inject(BeneficiarioServico);
  private readonly planoServico = inject(PlanoServico);
  private readonly simulador = inject(SimuladorApi);
  private readonly toast = inject(ToastServico);
  private readonly destroyRef = inject(DestroyRef);

  private requisicaoLista?: Subscription;
  private timerBusca?: ReturnType<typeof setTimeout>;

  protected readonly beneficiarios = signal<Beneficiario[]>([]);
  protected readonly planos = signal<Plano[]>([]);
  protected readonly carregando = signal(true);
  protected readonly jaCarregou = signal(false);
  protected readonly girandoRefresh = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly pagina = signal(1);
  protected readonly tamanho = signal(10);
  protected readonly total = signal(0);
  protected readonly filtroStatus = signal<StatusBeneficiario | ''>('');
  protected readonly filtroPlanoId = signal('');
  protected readonly filtroBusca = signal('');

  protected readonly formularioAberto = signal(false);
  protected readonly editando = signal<Beneficiario | null>(null);
  protected readonly excluindoId = signal<string | null>(null);

  protected readonly mapaDePlanos = computed(
    () => new Map(this.planos().map((plano) => [plano.id, plano.nome]))
  );
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.tamanho()))
  );
  protected readonly temFiltrosAtivos = computed(
    () =>
      this.filtroStatus() !== '' ||
      this.filtroPlanoId() !== '' ||
      this.filtroBusca().trim() !== ''
  );

  protected readonly formatarCpf = formatarCpf;
  protected readonly formatarData = formatarData;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.timerBusca));
    this.carregarPlanos();
    this.carregar();

    effect(() => {
      if (this.simulador.versaoDados() > 0) {
        untracked(() => this.carregar());
      }
    });
  }

  protected nomeDoPlano(planoId: string): string {
    return this.mapaDePlanos().get(planoId) ?? 'Plano indisponível';
  }

  protected carregarPlanos(): void {
    this.planoServico
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (planos) => this.planos.set(planos),
        error: () => {
          // Erro de rede já é exibido pela carga principal de beneficiários;
          // recarregar() tenta buscar os planos novamente se a lista estiver vazia.
        }
      });
  }

  protected recarregar(): void {
    this.girandoRefresh.set(true);
    setTimeout(() => this.girandoRefresh.set(false), 450);
    if (this.planos().length === 0) {
      this.carregarPlanos();
    }
    this.carregar();
  }

  protected carregar(): void {
    this.requisicaoLista?.unsubscribe();
    this.carregando.set(true);
    this.erro.set(null);

    const status = this.filtroStatus();
    const planoId = this.filtroPlanoId();
    const busca = this.filtroBusca().trim();

    this.requisicaoLista = this.servico
      .listar({
        pagina: this.pagina(),
        tamanho: this.tamanho(),
        status: status || null,
        plano_id: planoId || null,
        busca: busca || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resposta) => {
          this.beneficiarios.set(resposta.dados);
          this.pagina.set(resposta.pagina);
          this.tamanho.set(resposta.tamanho);
          this.total.set(resposta.total);
          this.jaCarregou.set(true);
          this.carregando.set(false);
        },
        error: (resposta: HttpErrorResponse) => {
          this.erro.set(mensagemDeErro(resposta));
          this.jaCarregou.set(true);
          this.carregando.set(false);
        }
      });
  }

  protected alterarFiltroStatus(valor: string): void {
    this.filtroStatus.set(valor as StatusBeneficiario | '');
    this.pagina.set(1);
    this.carregar();
  }

  protected alterarFiltroPlano(valor: string): void {
    this.filtroPlanoId.set(valor);
    this.pagina.set(1);
    this.carregar();
  }

  protected alterarTamanho(novoTamanho: number): void {
    if (novoTamanho >= 1 && novoTamanho <= 100) {
      this.tamanho.set(novoTamanho);
      this.pagina.set(1);
      this.carregar();
    }
  }

  protected alterarBusca(valor: string): void {
    this.filtroBusca.set(valor);
    clearTimeout(this.timerBusca);
    this.timerBusca = setTimeout(() => {
      this.pagina.set(1);
      this.carregar();
    }, 300);
  }

  protected limparFiltros(): void {
    clearTimeout(this.timerBusca);
    this.filtroStatus.set('');
    this.filtroPlanoId.set('');
    this.filtroBusca.set('');
    this.pagina.set(1);
    this.carregar();
  }

  protected irParaPagina(novaPagina: number): void {
    if (novaPagina < 1 || novaPagina > this.totalPaginas() || novaPagina === this.pagina()) {
      return;
    }
    this.pagina.set(novaPagina);
    this.carregar();
  }

  protected abrirCriacao(): void {
    this.editando.set(null);
    this.formularioAberto.set(true);
  }

  protected abrirEdicao(beneficiario: Beneficiario): void {
    this.editando.set(beneficiario);
    this.formularioAberto.set(true);
  }

  protected fecharFormulario(): void {
    this.formularioAberto.set(false);
    this.editando.set(null);
  }

  protected aoSalvar(): void {
    const eraEdicao = this.editando() !== null;
    this.formularioAberto.set(false);
    this.editando.set(null);
    this.toast.sucesso(
      eraEdicao ? 'Beneficiário atualizado' : 'Beneficiário cadastrado',
      eraEdicao
        ? 'As alterações foram salvas com sucesso.'
        : 'O novo cadastro já está disponível na listagem.'
    );
    this.carregar();
  }

  protected confirmarExclusao(beneficiario: Beneficiario): void {
    this.excluindoId.set(beneficiario.id);
    this.erro.set(null);

    this.servico
      .excluir(beneficiario.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.excluindoId.set(null);
          this.toast.sucesso(
            'Beneficiário excluído',
            `"${beneficiario.nome_completo}" foi removido da listagem.`
          );

          if (this.beneficiarios().length === 1 && this.pagina() > 1) {
            this.pagina.set(this.pagina() - 1);
          }

          this.carregar();
        },
        error: (resposta: HttpErrorResponse) => {
          this.excluindoId.set(null);
          const msg = mensagemDeErro(resposta);
          this.erro.set(msg);
          this.toast.erro('Não foi possível excluir', msg);
        }
      });
  }
}
