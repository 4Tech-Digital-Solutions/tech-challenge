import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { mensagemDeErro } from '../nucleo/api';
import { Plano } from '../planos/plano';
import { Botao } from '../ui/button';
import { Icone } from '../ui/icon';
import { INPUT_UI } from '../ui/input';
import { SELECT_UI } from '../ui/select';
import { ToastServico } from '../ui/toast';
import { Beneficiario, StatusBeneficiario, cpfValido } from './beneficiario';
import { BeneficiarioServico } from './beneficiario-servico';

function validarNome(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (valor.length === 0) {
    return { obrigatorio: true };
  }
  if (valor.length < 3 || valor.length > 120) {
    return { tamanho: true };
  }
  return null;
}

function validarCpf(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (valor.length === 0) {
    return { obrigatorio: true };
  }
  if (!/^\d{11}$/.test(valor)) {
    return { formato: true };
  }
  if (!cpfValido(valor)) {
    return { invalido: true };
  }
  return null;
}

function validarDataPassada(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (valor.length === 0) {
    return { obrigatorio: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { invalida: true };
  }

  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  if (valor >= hojeIso) {
    return { futura: true };
  }
  return null;
}

@Component({
  selector: 'app-beneficiario-form',
  imports: [ReactiveFormsModule, Botao, Icone, INPUT_UI, SELECT_UI],
  templateUrl: './beneficiario-form.html'
})
export class BeneficiarioForm {
  private readonly fb = inject(FormBuilder);
  private readonly servico = inject(BeneficiarioServico);
  private readonly toast = inject(ToastServico);
  private readonly destroyRef = inject(DestroyRef);

  readonly beneficiario = input<Beneficiario | null>(null);
  readonly planos = input.required<Plano[]>();

  readonly salvo = output<Beneficiario>();
  readonly cancelado = output<void>();

  protected readonly editando = computed(() => this.beneficiario() !== null);
  protected readonly salvando = signal(false);
  protected readonly erroApi = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nome_completo: ['', [validarNome]],
    cpf: ['', [validarCpf]],
    data_nascimento: ['', [validarDataPassada]],
    plano_id: ['', [Validators.required]],
    status: ['ATIVO' as StatusBeneficiario, [Validators.required]]
  });

  constructor() {
    effect(() => {
      const atual = this.beneficiario();
      this.erroApi.set(null);

      if (atual) {
        this.form.reset({
          nome_completo: atual.nome_completo,
          cpf: atual.cpf,
          data_nascimento: atual.data_nascimento,
          plano_id: atual.plano_id,
          status: atual.status
        });
        this.form.controls.cpf.disable({ emitEvent: false });
      } else {
        this.form.controls.cpf.enable({ emitEvent: false });
        this.form.reset({
          nome_completo: '',
          cpf: '',
          data_nascimento: '',
          plano_id: '',
          status: 'ATIVO'
        });
      }
    });
  }

  protected campoInvalido(nome: keyof typeof this.form.controls): boolean {
    const campo = this.form.controls[nome];
    return campo.invalid && (campo.dirty || campo.touched);
  }

  protected erroNome(): string | null {
    if (!this.campoInvalido('nome_completo')) return null;
    if (this.form.controls.nome_completo.errors?.['obrigatorio']) {
      return 'Informe o nome completo.';
    }
    return 'O nome precisa ter entre 3 e 120 caracteres.';
  }

  protected erroCpf(): string | null {
    if (this.editando() || !this.campoInvalido('cpf')) return null;
    if (this.form.controls.cpf.errors?.['obrigatorio']) return 'Informe o CPF.';
    if (this.form.controls.cpf.errors?.['formato']) return 'Informe os 11 dígitos do CPF.';
    return 'CPF inválido (verifique os dígitos).';
  }

  protected erroDataNascimento(): string | null {
    if (!this.campoInvalido('data_nascimento')) return null;
    if (this.form.controls.data_nascimento.errors?.['obrigatorio']) {
      return 'Informe a data de nascimento.';
    }
    if (this.form.controls.data_nascimento.errors?.['invalida']) {
      return 'Informe uma data válida no formato DD/MM/AAAA.';
    }
    return 'A data de nascimento precisa ser anterior a hoje.';
  }

  protected erroPlano(): string | null {
    return this.campoInvalido('plano_id') ? 'Selecione um plano.' : null;
  }

  protected salvar(): void {
    this.erroApi.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const atual = this.beneficiario();
    const valores = this.form.getRawValue();
    this.salvando.set(true);

    const requisicao$ = atual
      ? this.servico.atualizar(atual.id, {
          nome_completo: valores.nome_completo.trim(),
          data_nascimento: valores.data_nascimento,
          plano_id: valores.plano_id,
          status: valores.status
        })
      : this.servico.criar({
          nome_completo: valores.nome_completo.trim(),
          cpf: valores.cpf.trim(),
          data_nascimento: valores.data_nascimento,
          plano_id: valores.plano_id
        });

    requisicao$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resultado) => {
        this.salvando.set(false);
        this.salvo.emit(resultado);
      },
      error: (resposta: HttpErrorResponse) => {
        this.salvando.set(false);
        const msg = mensagemDeErro(resposta);
        this.erroApi.set(msg);
        this.toast.erro('Não foi possível salvar', msg);
      }
    });
  }

  protected fechar(): void {
    if (!this.salvando()) {
      this.cancelado.emit();
    }
  }
}
