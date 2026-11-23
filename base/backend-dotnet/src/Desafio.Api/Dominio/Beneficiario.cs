using System.Text.RegularExpressions;

namespace Desafio.Api.Dominio;

public enum StatusBeneficiario
{
    ATIVO,
    INATIVO,
}

public partial class Beneficiario
{
    private Beneficiario() { }

    public Beneficiario(string? nomeCompleto, string? cpf, DateOnly? dataNascimento, Guid? planoId)
    {
        Id = Guid.NewGuid();
        Status = StatusBeneficiario.ATIVO;
        DataCadastro = DateTime.UtcNow;

        // O CPF só é validado aqui: depois de criado ele não muda (SPEC: o PUT ignora o cpf).
        cpf = cpf?.Trim() ?? string.Empty;
        var detalhes = new List<DetalheErro>();

        if (cpf.Length == 0)
        {
            detalhes.Add(new DetalheErro("cpf", "obrigatorio"));
        }
        else if (!FormatoDoCpf().IsMatch(cpf))
        {
            detalhes.Add(new DetalheErro("cpf", "formato_invalido"));
        }
        else if (!CpfValido(cpf))
        {
            detalhes.Add(new DetalheErro("cpf", "invalido"));
        }

        Cpf = cpf;
        DefinirDados(nomeCompleto, dataNascimento, planoId, detalhes);
    }

    public Guid Id { get; private set; }

    public string NomeCompleto { get; private set; } = null!;

    public string Cpf { get; private set; } = null!;

    public DateOnly DataNascimento { get; private set; }

    public StatusBeneficiario Status { get; private set; }

    public Guid PlanoId { get; private set; }

    public Plano? Plano { get; set; }

    public DateTime DataCadastro { get; private set; }

    public DateTime? ExcluidoEm { get; private set; }

    public void Atualizar(
        string? nomeCompleto,
        DateOnly? dataNascimento,
        Guid? planoId,
        StatusBeneficiario? status)
    {
        var detalhes = new List<DetalheErro>();

        if (status is null)
        {
            detalhes.Add(new DetalheErro("status", "obrigatorio"));
        }
        else if (!Enum.IsDefined(status.Value))
        {
            detalhes.Add(new DetalheErro("status", "invalido"));
        }

        // Beneficiário INATIVO é congelado: alterar dados cadastrais sem reativar gera 409.
        if (Status == StatusBeneficiario.INATIVO && status == StatusBeneficiario.INATIVO)
        {
            var nomeNormalizado = nomeCompleto?.Trim() ?? string.Empty;
            var dadosAlterados =
                nomeNormalizado != NomeCompleto ||
                dataNascimento != DataNascimento ||
                planoId != PlanoId;

            if (dadosAlterados)
            {
                throw new ConflitoException("Beneficiário inativo não pode ter dados cadastrais alterados");
            }
        }

        DefinirDados(nomeCompleto, dataNascimento, planoId, detalhes);
        Status = status!.Value;
    }

    public void Excluir() => ExcluidoEm = DateTime.UtcNow;

    // Recebe a lista de erros já encontrados (o CPF, na criação) para devolver todos juntos.
    private void DefinirDados(
        string? nomeCompleto,
        DateOnly? dataNascimento,
        Guid? planoId,
        List<DetalheErro> detalhes)
    {
        nomeCompleto = nomeCompleto?.Trim() ?? string.Empty;

        if (nomeCompleto.Length == 0)
        {
            detalhes.Add(new DetalheErro("nome_completo", "obrigatorio"));
        }
        else if (nomeCompleto.Length is < 3 or > 120)
        {
            detalhes.Add(new DetalheErro("nome_completo", "tamanho_invalido"));
        }

        if (dataNascimento is null)
        {
            detalhes.Add(new DetalheErro("data_nascimento", "obrigatorio"));
        }
        else if (dataNascimento >= DateOnly.FromDateTime(DateTime.UtcNow))
        {
            detalhes.Add(new DetalheErro("data_nascimento", "precisa_ser_passada"));
        }

        if (planoId is null || planoId == Guid.Empty)
        {
            detalhes.Add(new DetalheErro("plano_id", "obrigatorio"));
        }

        if (detalhes.Count > 0)
        {
            throw new ValidacaoException("Dados do beneficiário inválidos", detalhes);
        }

        NomeCompleto = nomeCompleto;
        DataNascimento = dataNascimento!.Value;
        PlanoId = planoId!.Value;
    }

    private static bool CpfValido(string cpf)
    {
        if (cpf.All(c => c == cpf[0]))
        {
            return false;
        }

        return DigitoVerificador(cpf, 9) == cpf[9] - '0' &&
               DigitoVerificador(cpf, 10) == cpf[10] - '0';
    }

    private static int DigitoVerificador(string cpf, int tamanho)
    {
        var soma = 0;
        for (var i = 0; i < tamanho; i++)
        {
            soma += (cpf[i] - '0') * (tamanho + 1 - i);
        }

        var resto = soma * 10 % 11;
        return resto == 10 ? 0 : resto;
    }

    [GeneratedRegex("^[0-9]{11}$")]
    private static partial Regex FormatoDoCpf();
}
