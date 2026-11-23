import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { BeneficiarioServico } from './beneficiarios/beneficiario-servico';
import { SimuladorApi } from './nucleo/simulador-api';
import { PlanoServico } from './planos/plano-servico';
import { Botao } from './ui/button';
import { Icone } from './ui/icon';
import { MENU_UI } from './ui/menu';
import { ToastServico, Toaster } from './ui/toast';

const NOMES_DEMO = [
  'Ana Paula Ferreira',
  'Bruno Henrique Costa',
  'Camila Rodrigues Lima',
  'Daniel Oliveira Santos',
  'Eduarda Martins Souza',
  'Felipe Augusto Almeida',
  'Gabriela Mendes Rocha',
  'Henrique Barbosa Dias',
  'Isabela Cristina Nunes',
  'João Pedro Carvalho',
  'Larissa Gomes Teixeira',
  'Lucas Vinicius Ribeiro',
  'Mariana Alves Pereira',
  'Rafael Monteiro Castro',
  'Thiago Nogueira Cardoso'
] as const;

const SEMENTE_BASE_DEMO = 410_000_000;

function gerarCpfValido(semente: number): string {
  const base = String(semente % 1_000_000_000).padStart(9, '0');
  const digitos = base.split('').map(Number);

  if (digitos.every((d) => d === digitos[0])) {
    digitos[8] = (digitos[8] + 1) % 10;
  }

  const calcDv = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += digitos[i] * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  digitos.push(calcDv(9));
  digitos.push(calcDv(10));
  return digitos.join('');
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Botao, Icone, MENU_UI, Toaster],
  templateUrl: './app.html'
})
export class App {
  protected readonly simulador = inject(SimuladorApi);
  private readonly beneficiarioServico = inject(BeneficiarioServico);
  private readonly planoServico = inject(PlanoServico);
  private readonly toast = inject(ToastServico);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly atalhosAtraso = [0, 600, 1500] as const;
  protected readonly populando = signal(false);

  protected aoAlterarAtraso(valor: string): void {
    this.simulador.definirAtraso(Number(valor));
  }

  protected popularDemo(): void {
    if (this.populando() || this.simulador.forcarErro()) return;

    this.populando.set(true);

    // Checa antes se o conjunto de demo já existe para evitar disparar 409 no console.
    // Os CPFs determinísticos garantem idempotência definitiva no banco.
    this.beneficiarioServico
      .listar({ pagina: 1, tamanho: 1, busca: NOMES_DEMO[0] })
      .pipe(
        switchMap((existente) => {
          if (existente.total > 0) {
            return of<'ja-populado'>('ja-populado');
          }

          return this.planoServico.listar().pipe(
            switchMap((planos) => {
              if (planos.length === 0) {
                return of<number>(0);
              }

              const chamadas = NOMES_DEMO.map((nome, idx) => {
                const ano = 1972 + ((idx * 3) % 30);
                const mes = String(((idx * 5) % 12) + 1).padStart(2, '0');
                const dia = String(((idx * 7) % 27) + 1).padStart(2, '0');

                return this.beneficiarioServico
                  .criar({
                    nome_completo: nome,
                    cpf: gerarCpfValido(SEMENTE_BASE_DEMO + idx * 101),
                    data_nascimento: `${ano}-${mes}-${dia}`,
                    plano_id: planos[idx % planos.length].id
                  })
                  .pipe(catchError(() => of(null)));
              });

              return forkJoin(chamadas).pipe(
                switchMap((resultados) => of(resultados.filter((r) => r !== null).length))
              );
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resultado) => {
          this.populando.set(false);

          if (resultado === 'ja-populado' || resultado === 0) {
            this.toast.info(
              'Dados de demo já populados',
              'Os beneficiários de demonstração já existem na base.'
            );
            return;
          }

          this.simulador.notificarDadosAtualizados();
          this.toast.sucesso(
            `${resultado} beneficiários adicionados`,
            'Pronto para testar busca, filtros e paginação.'
          );
        },
        error: () => {
          this.populando.set(false);
          this.toast.erro('Não foi possível popular', 'Verifique se a API está respondendo.');
        }
      });
  }
}
