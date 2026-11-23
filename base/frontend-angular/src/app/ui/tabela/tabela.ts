import { Component, Directive, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'app-tabela',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="app-tabela-container"
      [class.app-tabela-limpa]="variante() === 'limpa'"
      [attr.aria-busy]="pendente() || null"
    >
      <div class="app-tabela-scroll">
        <table class="app-tabela">
          <ng-content />
        </table>
      </div>
      <div
        class="app-tabela-pendente"
        [class.ativo]="pendente()"
        aria-hidden="true"
      ></div>
    </div>
  `,
  styles: `
    app-tabela {
      display: block;
    }

    app-tabela .app-tabela-container {
      position: relative;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fff;
      overflow: hidden;
    }

    app-tabela .app-tabela-container.app-tabela-limpa {
      border: none;
      border-radius: 0;
    }

    app-tabela .app-tabela-scroll {
      overflow-x: auto;
    }

    app-tabela .app-tabela {
      width: 100%;
      border-collapse: collapse;
    }

    /* Overlay suave com delay curto: requisições instantâneas em localhost não piscam,
       mas carregamentos perceptíveis escurecem sutilmente a tabela mantendo as linhas legíveis. */
    app-tabela .app-tabela-pendente {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.04);
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease;
    }

    app-tabela .app-tabela-pendente.ativo {
      opacity: 1;
      transition-delay: 110ms;
    }

    app-tabela thead[appTabelaCabecalho] {
      background: #f8fafc;
    }

    app-tabela th[appTabelaCabecalhoCelula] {
      text-align: left;
      padding: 0.72rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.78rem;
      font-weight: 500;
      color: #64748b;
      white-space: nowrap;
    }

    app-tabela th[appTabelaCabecalhoCelula].alinhar-direita {
      text-align: right;
    }

    app-tabela tr[appTabelaLinha] {
      border-bottom: 1px solid #f1f5f9;
      transition: background 120ms ease;
    }

    app-tabela tbody tr[appTabelaLinha]:last-child {
      border-bottom: none;
    }

    app-tabela tbody tr[appTabelaLinha]:hover {
      background: #f8fafc;
    }

    app-tabela tr[appTabelaLinha].ativa {
      background: #eff6ff;
    }

    app-tabela tr[appTabelaLinha].clicavel {
      cursor: pointer;
    }

    app-tabela td[appTabelaCelula] {
      text-align: left;
      padding: 0.8rem 1rem;
      vertical-align: middle;
      font-size: 0.875rem;
      color: #334155;
    }

    app-tabela td[appTabelaCelula].variante-destaque {
      font-weight: 500;
      color: #0f172a;
    }

    app-tabela td[appTabelaCelula].variante-mono {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: #475569;
    }

    app-tabela td[appTabelaCelula].variante-acoes {
      text-align: right;
      white-space: nowrap;
    }

    app-tabela .tabela-estado-celula {
      padding: 3rem 1.25rem;
      text-align: center;
      color: #64748b;
      background: #fff;
    }

    app-tabela .tabela-estado-celula p {
      margin: 0 0 0.85rem;
      font-size: 0.9rem;
    }

    app-tabela .tabela-estado-celula p:last-child {
      margin-bottom: 0;
    }

    app-tabela .tabela-estado-celula.erro {
      color: #991b1b;
      background: #fef2f2;
    }
  `
})
export class Tabela {
  readonly pendente = input(false);
  readonly variante = input<'cartao' | 'limpa'>('cartao');
}

@Directive({
  selector: 'thead[appTabelaCabecalho]'
})
export class TabelaCabecalho {}

@Component({
  selector: 'tbody[appTabelaCorpo]',
  template: `
    @if (carregando()) {
      <tr>
        <td [attr.colspan]="colunas()" class="tabela-estado-celula">
          <p>{{ mensagemCarregando() }}</p>
        </td>
      </tr>
    } @else if (erro()) {
      <tr>
        <td [attr.colspan]="colunas()" class="tabela-estado-celula erro">
          <p>{{ erro() }}</p>
        </td>
      </tr>
    } @else if (vazio()) {
      <tr>
        <td [attr.colspan]="colunas()" class="tabela-estado-celula">
          <ng-content select="[tabelaVazio]">
            <p>{{ mensagemVazio() }}</p>
          </ng-content>
        </td>
      </tr>
    } @else {
      <ng-content />
    }
  `
})
export class TabelaCorpo {
  readonly colunas = input.required<number>();
  readonly carregando = input(false);
  readonly erro = input<string | null>(null);
  readonly vazio = input(false);
  readonly mensagemCarregando = input('Carregando...');
  readonly mensagemVazio = input('Nenhum registro encontrado.');
}

@Directive({
  selector: 'tr[appTabelaLinha]',
  host: {
    '[class.ativa]': 'ativa()',
    '[class.clicavel]': 'clicavel()'
  }
})
export class TabelaLinha {
  readonly ativa = input(false);
  readonly clicavel = input(false);
}

@Directive({
  selector: 'th[appTabelaCabecalhoCelula]',
  host: {
    '[class.alinhar-direita]': "alinhar() === 'direita'"
  }
})
export class TabelaCabecalhoCelula {
  readonly alinhar = input<'esquerda' | 'direita'>('esquerda');
}

@Directive({
  selector: 'td[appTabelaCelula]',
  host: {
    '[class.variante-destaque]': "variante() === 'destaque'",
    '[class.variante-mono]': "variante() === 'mono'",
    '[class.variante-acoes]': "variante() === 'acoes'"
  }
})
export class TabelaCelula {
  readonly variante = input<'padrao' | 'destaque' | 'mono' | 'acoes'>('padrao');
}
