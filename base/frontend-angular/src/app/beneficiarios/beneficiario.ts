export type StatusBeneficiario = 'ATIVO' | 'INATIVO';

export interface Beneficiario {
  id: string;
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  status: StatusBeneficiario;
  plano_id: string;
  data_cadastro: string;
}

export interface BeneficiariosPaginados {
  dados: Beneficiario[];
  pagina: number;
  tamanho: number;
  total: number;
}

export interface FiltrosBeneficiarios {
  pagina: number;
  tamanho: number;
  status?: StatusBeneficiario | null;
  plano_id?: string | null;
  busca?: string | null;
}

export interface CriarBeneficiarioPayload {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  plano_id: string;
}

export interface AtualizarBeneficiarioPayload {
  nome_completo: string;
  data_nascimento: string;
  plano_id: string;
  status: StatusBeneficiario;
}

export function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, '');
  if (digitos.length !== 11) {
    return cpf;
  }
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

export function formatarData(isoDate: string): string {
  const partes = isoDate.split('-');
  if (partes.length !== 3) {
    return isoDate;
  }
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcularDigito = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}
