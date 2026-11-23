using Desafio.Api.Dominio;
using Desafio.Api.Infraestrutura;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Desafio.Api.Aplicacao;

public class BeneficiarioServico(AppDbContext db)
{
    private const string CodigoViolacaoDeUnicidade = "23505";

    public async Task<BeneficiariosPaginados> ListarAsync(ListarBeneficiariosFiltro filtro, CancellationToken cancellationToken)
    {
        var detalhes = new List<DetalheErro>();

        if (filtro.Pagina < 1)
        {
            detalhes.Add(new DetalheErro("pagina", "invalido"));
        }

        if (filtro.Tamanho is < 1 or > 100)
        {
            detalhes.Add(new DetalheErro("tamanho", "invalido"));
        }

        if (filtro.Status is not null && !Enum.IsDefined(filtro.Status.Value))
        {
            detalhes.Add(new DetalheErro("status", "invalido"));
        }

        if (detalhes.Count > 0)
        {
            throw new ValidacaoException("Parâmetros de consulta inválidos", detalhes);
        }

        var consulta = db.Beneficiarios.AsNoTracking();

        if (filtro.Status is not null)
        {
            consulta = consulta.Where(b => b.Status == filtro.Status);
        }

        if (filtro.PlanoId is not null)
        {
            consulta = consulta.Where(b => b.PlanoId == filtro.PlanoId);
        }

        if (!string.IsNullOrWhiteSpace(filtro.Busca))
        {
            var termo = filtro.Busca.Trim();
            consulta = consulta.Where(b => EF.Functions.ILike(b.NomeCompleto, $"%{termo}%"));
        }

        var total = await consulta.CountAsync(cancellationToken);

        var dados = await consulta
            .OrderBy(b => b.NomeCompleto)
            .ThenBy(b => b.Id)
            .Skip((filtro.Pagina - 1) * filtro.Tamanho)
            .Take(filtro.Tamanho)
            .ToListAsync(cancellationToken);

        return new BeneficiariosPaginados(dados, filtro.Pagina, filtro.Tamanho, total);
    }

    public async Task<Beneficiario> ObterAsync(Guid id, CancellationToken cancellationToken)
    {
        return await db.Beneficiarios.FirstOrDefaultAsync(b => b.Id == id, cancellationToken)
            ?? throw new NaoEncontradoException("Beneficiário não encontrado");
    }

    public async Task<Beneficiario> CriarAsync(BeneficiarioRequestDados dados, CancellationToken cancellationToken)
    {
        var beneficiario = new Beneficiario(dados.NomeCompleto, dados.Cpf, dados.DataNascimento, dados.PlanoId);

        await GarantirPlanoExistenteAsync(beneficiario.PlanoId, cancellationToken);
        await GarantirCpfUnicoAsync(beneficiario.Cpf, cancellationToken);

        db.Beneficiarios.Add(beneficiario);
        await SalvarAsync(cancellationToken);
        return beneficiario;
    }

    public async Task<Beneficiario> AtualizarAsync(Guid id, AtualizarBeneficiarioDados dados, CancellationToken cancellationToken)
    {
        var beneficiario = await ObterAsync(id, cancellationToken);

        beneficiario.Atualizar(dados.NomeCompleto, dados.DataNascimento, dados.PlanoId, dados.Status);
        await GarantirPlanoExistenteAsync(beneficiario.PlanoId, cancellationToken);
        await SalvarAsync(cancellationToken);

        return beneficiario;
    }

    public async Task ExcluirAsync(Guid id, CancellationToken cancellationToken)
    {
        var beneficiario = await ObterAsync(id, cancellationToken);

        beneficiario.Excluir();
        await SalvarAsync(cancellationToken);
    }

    private async Task GarantirCpfUnicoAsync(string cpf, CancellationToken cancellationToken)
    {
        var conflito = await db.Beneficiarios
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.Cpf == cpf)
            .FirstOrDefaultAsync(cancellationToken);

        if (conflito is null)
        {
            return;
        }

        throw new ConflitoException(
            "Já existe um beneficiário cadastrado com esse CPF",
            [new DetalheErro("cpf", "duplicado")]);
    }

    private async Task SalvarAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException excecao) when (EhViolacaoDeUnicidade(excecao))
        {
            throw new ConflitoException(
                "Já existe um beneficiário cadastrado com esse CPF",
                [new DetalheErro("cpf", "duplicado")]);
        }
    }

    private static bool EhViolacaoDeUnicidade(DbUpdateException excecao) =>
        excecao.InnerException is PostgresException postgres &&
        postgres.SqlState == CodigoViolacaoDeUnicidade;

    private async Task GarantirPlanoExistenteAsync(Guid planoId, CancellationToken cancellationToken)
    {
        var planoExiste = await db.Planos.AnyAsync(p => p.Id == planoId, cancellationToken);

        if (!planoExiste)
        {
            throw new NaoProcessavelException("Plano não encontrado", [new DetalheErro("plano_id", "inexistente")]);
        }
    }
}

public sealed record BeneficiarioRequestDados(
    string? NomeCompleto,
    string? Cpf,
    DateOnly? DataNascimento,
    Guid? PlanoId);

public sealed record AtualizarBeneficiarioDados(
    string? NomeCompleto,
    DateOnly? DataNascimento,
    Guid? PlanoId,
    StatusBeneficiario? Status);

public sealed record ListarBeneficiariosFiltro(
    int Pagina,
    int Tamanho,
    StatusBeneficiario? Status,
    Guid? PlanoId,
    string? Busca = null);

public sealed record BeneficiariosPaginados(
    IReadOnlyList<Beneficiario> Dados,
    int Pagina,
    int Tamanho,
    int Total);
