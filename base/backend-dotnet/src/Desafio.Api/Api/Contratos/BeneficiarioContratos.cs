using Desafio.Api.Dominio;

namespace Desafio.Api.Api.Contratos;

// Só os 4 campos que a SPEC aceita: id, status e data_cadastro enviados pelo cliente são ignorados.
public sealed record BeneficiarioRequest(
    string? NomeCompleto,
    string? Cpf,
    DateOnly? DataNascimento,
    Guid? PlanoId
);

public sealed record AtualizarBeneficiarioRequest(
    string? NomeCompleto,
    DateOnly? DataNascimento,
    Guid? PlanoId,
    StatusBeneficiario? Status
);

public sealed record BeneficiarioResponse(
    Guid Id,
    string NomeCompleto,
    string Cpf,
    DateOnly DataNascimento,
    StatusBeneficiario Status,
    Guid PlanoId,
    DateTime DataCadastro
)
{
    public static BeneficiarioResponse De(Beneficiario beneficiario) =>
        new(
            beneficiario.Id,
            beneficiario.NomeCompleto,
            beneficiario.Cpf,
            beneficiario.DataNascimento,
            beneficiario.Status,
            beneficiario.PlanoId,
            beneficiario.DataCadastro
        );
}

public sealed record BeneficiariosPaginadosResponse(
    IReadOnlyList<BeneficiarioResponse> Dados,
    int Pagina,
    int Tamanho,
    int Total);
