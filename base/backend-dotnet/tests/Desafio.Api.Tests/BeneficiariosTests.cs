using System.Net;
namespace Desafio.Api.Tests;

[Collection(ColecaoDaApi.Nome)]
public class BeneficiariosTests(ApiFixture fixture) : IAsyncLifetime
{
    private HttpClient Client => fixture.Client;

    public Task InitializeAsync() => fixture.LimparAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static object CorpoDeCriacao(string cpf, Guid? planoId = null) => new
    {
        NomeCompleto = "Maria Aparecida da Silva",
        Cpf = cpf,
        DataNascimento = "1990-05-12",
        PlanoId = planoId ?? Planos.Bronze
    };

    // ------------------------------------------------------------------ criação

    [Fact]
    public async Task Criar_deve_devolver_201_com_header_location()
    {
        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao("52998224725")));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        Assert.NotNull(resposta.Headers.Location);

        var corpo = await resposta.CorpoAsync();
        Assert.NotEqual(Guid.Empty, corpo.GetProperty("id").GetGuid());
        Assert.Equal("52998224725", corpo.GetProperty("cpf").GetString());
        Assert.Equal("ATIVO", corpo.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Criar_com_cpf_ja_cadastrado_deve_devolver_409()
    {
        await Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao("71428793860")));

        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao("71428793860")));

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task Criar_com_mesmo_cpf_simultaneamente_deve_criar_apenas_um()
    {
        var respostas = await Task.WhenAll(
            Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao("71428793860"))),
            Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao("71428793860"))));

        var status = respostas.Select(r => r.StatusCode).OrderBy(s => s).ToArray();
        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], status);
    }

    [Fact]
    public async Task Criar_com_plano_inexistente_deve_devolver_422()
    {
        var resposta = await Client.PostAsync(
            "/beneficiarios",
            Http.Json(CorpoDeCriacao("39053344705", Planos.Inexistente)));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
    }

    [Fact]
    public async Task Criar_enviando_campos_do_servidor_deve_ignora_los()
    {
        var idForjado = Guid.NewGuid();
        var dataCadastroForjada = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(new
        {
            Id = idForjado,
            NomeCompleto = "Maria Aparecida da Silva",
            Cpf = "52998224725",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Bronze,
            Status = "INATIVO",
            DataCadastro = dataCadastroForjada
        }));

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.NotEqual(idForjado, corpo.GetProperty("id").GetGuid());
        Assert.Equal("ATIVO", corpo.GetProperty("status").GetString());
        Assert.NotEqual(dataCadastroForjada, corpo.GetProperty("data_cadastro").GetDateTime().ToUniversalTime());
    }

    [Fact]
    public async Task Criar_com_dados_invalidos_deve_devolver_400_detalhando_os_campos()
    {
        var amanha = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)).ToString("yyyy-MM-dd");

        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(new
        {
            NomeCompleto = "ab",
            Cpf = "123",
            DataNascimento = amanha,
            PlanoId = Planos.Bronze
        }));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        var campos = corpo.GetProperty("detalhes")
            .EnumerateArray()
            .Select(detalhe => detalhe.GetProperty("campo").GetString())
            .ToList();

        Assert.Contains("nome_completo", campos);
        Assert.Contains("cpf", campos);
        Assert.Contains("data_nascimento", campos);
    }

    [Theory]
    [InlineData("11111111111")]
    [InlineData("52998224720")]
    [InlineData("123")]
    public async Task Criar_com_cpf_invalido_deve_devolver_400(string cpfInvalido)
    {
        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao(cpfInvalido)));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Plano_excluido_nao_aceita_novos_beneficiarios_mas_mantem_os_existentes()
    {
        var existente = (await fixture.SemearBeneficiariosAsync(1, Planos.Bronze)).Single();

        var exclusaoPlano = await Client.DeleteAsync($"/planos/{Planos.Bronze}");
        Assert.Equal(HttpStatusCode.NoContent, exclusaoPlano.StatusCode);

        var consultaExistente = await Client.GetAsync($"/beneficiarios/{existente.Id}");
        Assert.Equal(HttpStatusCode.OK, consultaExistente.StatusCode);

        var novoNoPlanoExcluido = await Client.PostAsync(
            "/beneficiarios",
            Http.Json(CorpoDeCriacao("52998224725", Planos.Bronze)));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, novoNoPlanoExcluido.StatusCode);
    }

    // ------------------------------------------------------------------ consulta por id

    [Fact]
    public async Task Obter_deve_devolver_o_beneficiario()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var resposta = await Client.GetAsync($"/beneficiarios/{beneficiario.Id}");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal(beneficiario.Id, corpo.GetProperty("id").GetGuid());
        Assert.Equal(beneficiario.Cpf, corpo.GetProperty("cpf").GetString());
        Assert.Equal(Planos.Bronze, corpo.GetProperty("plano_id").GetGuid());
    }

    [Fact]
    public async Task Obter_inexistente_deve_devolver_404()
    {
        var resposta = await Client.GetAsync($"/beneficiarios/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    // ------------------------------------------------------------------ atualização

    [Fact]
    public async Task Atualizar_deve_alterar_os_dados_do_beneficiario()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Joana Ribeiro Nunes",
            DataNascimento = "1985-03-20",
            PlanoId = Planos.Ouro,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal("Joana Ribeiro Nunes", corpo.GetProperty("nome_completo").GetString());
        Assert.Equal(Planos.Ouro, corpo.GetProperty("plano_id").GetGuid());
    }

    [Fact]
    public async Task Atualizar_inexistente_deve_devolver_404()
    {
        var resposta = await Client.PutAsync($"/beneficiarios/{Guid.NewGuid()}", Http.Json(new
        {
            NomeCompleto = "Nao Existe",
            DataNascimento = "1985-03-20",
            PlanoId = Planos.Ouro,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Atualizar_apontando_para_plano_inexistente_deve_devolver_422()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Maria Aparecida da Silva",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Inexistente,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
    }

    [Fact]
    public async Task Atualizar_enviando_cpf_deve_ignorar_o_cpf()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Joana Ribeiro Nunes",
            Cpf = "71428793860",
            DataNascimento = "1985-03-20",
            PlanoId = Planos.Ouro,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal(beneficiario.Cpf, corpo.GetProperty("cpf").GetString());
    }

    [Fact]
    public async Task Reativar_beneficiario_inativo_deve_devolver_200()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(
            1, Planos.Bronze, "INATIVO", 500)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Nome Corrigido na Reativacao",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Bronze,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal("ATIVO", corpo.GetProperty("status").GetString());
        Assert.Equal("Nome Corrigido na Reativacao", corpo.GetProperty("nome_completo").GetString());
    }

    // ------------------------------------------------------------------ exclusão

    [Fact]
    public async Task Excluir_deve_ser_logico_e_tirar_o_beneficiario_das_consultas()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var exclusao = await Client.DeleteAsync($"/beneficiarios/{beneficiario.Id}");
        Assert.Equal(HttpStatusCode.NoContent, exclusao.StatusCode);

        var consulta = await Client.GetAsync($"/beneficiarios/{beneficiario.Id}");
        Assert.Equal(HttpStatusCode.NotFound, consulta.StatusCode);

        var listagem = await (await Client.GetAsync("/beneficiarios?pagina=1&tamanho=50")).CorpoAsync();
        Assert.Equal(0, listagem.GetProperty("total").GetInt32());

        var novaExclusao = await Client.DeleteAsync($"/beneficiarios/{beneficiario.Id}");
        Assert.Equal(HttpStatusCode.NotFound, novaExclusao.StatusCode);

        var atualizacao = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Tentativa Apos Exclusao",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Bronze,
            Status = "ATIVO"
        }));
        Assert.Equal(HttpStatusCode.NotFound, atualizacao.StatusCode);
    }

    [Fact]
    public async Task Cpf_de_beneficiario_excluido_deve_continuar_ocupado()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        await Client.DeleteAsync($"/beneficiarios/{beneficiario.Id}");

        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(CorpoDeCriacao(beneficiario.Cpf)));

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    // ------------------------------------------------------------------ listagem

    [Fact]
    public async Task Listar_deve_devolver_envelope_paginado()
    {
        await fixture.SemearBeneficiariosAsync(3);

        var resposta = await Client.GetAsync("/beneficiarios?pagina=1&tamanho=10");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal(3, corpo.GetProperty("dados").GetArrayLength());
        Assert.Equal(1, corpo.GetProperty("pagina").GetInt32());
        Assert.Equal(10, corpo.GetProperty("tamanho").GetInt32());
        Assert.Equal(3, corpo.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Listar_deve_respeitar_pagina_e_tamanho()
    {
        await fixture.SemearBeneficiariosAsync(25);

        var corpo = await (await Client.GetAsync("/beneficiarios?pagina=3&tamanho=10")).CorpoAsync();

        Assert.Equal(5, corpo.GetProperty("dados").GetArrayLength());
        Assert.Equal(3, corpo.GetProperty("pagina").GetInt32());
        Assert.Equal(25, corpo.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Listar_deve_combinar_os_filtros_de_status_e_plano()
    {
        await fixture.SemearBeneficiariosAsync(4, Planos.Bronze, "ATIVO", 100);
        await fixture.SemearBeneficiariosAsync(6, Planos.Bronze, "INATIVO", 200);
        await fixture.SemearBeneficiariosAsync(3, Planos.Prata, "ATIVO", 300);

        var corpo = await (await Client.GetAsync(
            $"/beneficiarios?tamanho=50&status=ATIVO&plano_id={Planos.Bronze}")).CorpoAsync();

        Assert.Equal(4, corpo.GetProperty("total").GetInt32());
        Assert.All(
            corpo.GetProperty("dados").EnumerateArray(),
            beneficiario =>
            {
                Assert.Equal("ATIVO", beneficiario.GetProperty("status").GetString());
                Assert.Equal(Planos.Bronze, beneficiario.GetProperty("plano_id").GetGuid());
            });
    }

    // Ajustado de 20 para 10 seguindo a SPEC (seção 3): tamanho padrão é 10 quando ausente.
    // Decisão registrada no README.
    [Fact]
    public async Task Listar_sem_informar_tamanho_deve_devolver_10_itens_por_pagina()
    {
        await fixture.SemearBeneficiariosAsync(25);

        var corpo = await (await Client.GetAsync("/beneficiarios")).CorpoAsync();

        Assert.Equal(10, corpo.GetProperty("dados").GetArrayLength());
        Assert.Equal(10, corpo.GetProperty("tamanho").GetInt32());
        Assert.Equal(25, corpo.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Listar_com_paginacao_invalida_deve_devolver_400()
    {
        var paginaInvalida = await Client.GetAsync("/beneficiarios?pagina=0");
        var tamanhoInvalido = await Client.GetAsync("/beneficiarios?tamanho=101");

        Assert.Equal(HttpStatusCode.BadRequest, paginaInvalida.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tamanhoInvalido.StatusCode);
    }

    [Fact]
    public async Task Listar_pagina_alem_do_total_deve_devolver_200_com_dados_vazios()
    {
        await fixture.SemearBeneficiariosAsync(3);

        var resposta = await Client.GetAsync("/beneficiarios?pagina=10&tamanho=10");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal(0, corpo.GetProperty("dados").GetArrayLength());
        Assert.Equal(3, corpo.GetProperty("total").GetInt32());
    }

    // Ajustado de 200 para 409 seguindo a SPEC (seção 2.3): beneficiário INATIVO é congelado
    // e não permite alterar dados cadastrais sem reativação. Decisão registrada no README.
    [Fact]
    public async Task Atualizar_dados_de_beneficiario_inativo_deve_devolver_409()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(
            1, Planos.Bronze, "INATIVO", 500)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = "Nome Corrigido do Inativo",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Bronze,
            Status = "INATIVO"
        }));

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task Inativar_beneficiario_deve_devolver_200_e_manter_registro_nas_consultas()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1, Planos.Bronze, "ATIVO", 600)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = beneficiario.NomeCompleto,
            DataNascimento = beneficiario.DataNascimento.ToString("yyyy-MM-dd"),
            PlanoId = beneficiario.PlanoId,
            Status = "INATIVO"
        }));

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var corpo = await resposta.CorpoAsync();
        Assert.Equal("INATIVO", corpo.GetProperty("status").GetString());

        var consulta = await Client.GetAsync($"/beneficiarios/{beneficiario.Id}");
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        var listagem = await (await Client.GetAsync("/beneficiarios?status=INATIVO")).CorpoAsync();
        Assert.Equal(1, listagem.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Listar_com_filtro_busca_deve_filtrar_por_nome()
    {
        await Client.PostAsync("/beneficiarios", Http.Json(new
        {
            NomeCompleto = "Maria Clara Souza",
            Cpf = "52998224725",
            DataNascimento = "1990-05-12",
            PlanoId = Planos.Bronze
        }));
        await Client.PostAsync("/beneficiarios", Http.Json(new
        {
            NomeCompleto = "Joao Pedro Lima",
            Cpf = "71428793860",
            DataNascimento = "1988-03-10",
            PlanoId = Planos.Bronze
        }));

        var resposta = await Client.GetAsync("/beneficiarios?busca=maria");
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);

        var corpo = await resposta.CorpoAsync();
        Assert.Equal(1, corpo.GetProperty("total").GetInt32());
        Assert.Equal("Maria Clara Souza", corpo.GetProperty("dados")[0].GetProperty("nome_completo").GetString());
    }

    [Fact]
    public async Task Atualizar_com_status_numerico_invalido_deve_devolver_400()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1)).Single();

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = beneficiario.NomeCompleto,
            DataNascimento = beneficiario.DataNascimento.ToString("yyyy-MM-dd"),
            PlanoId = beneficiario.PlanoId,
            Status = 99
        }));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Listar_com_status_numerico_invalido_deve_devolver_400()
    {
        var resposta = await Client.GetAsync("/beneficiarios?status=99");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Criar_com_data_nascimento_hoje_deve_devolver_400()
    {
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");

        var resposta = await Client.PostAsync("/beneficiarios", Http.Json(new
        {
            NomeCompleto = "Maria Aparecida da Silva",
            Cpf = "52998224725",
            DataNascimento = hoje,
            PlanoId = Planos.Bronze
        }));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Atualizar_apontando_para_plano_excluido_deve_devolver_422()
    {
        var beneficiario = (await fixture.SemearBeneficiariosAsync(1, Planos.Bronze)).Single();
        await Client.DeleteAsync($"/planos/{Planos.Prata}");

        var resposta = await Client.PutAsync($"/beneficiarios/{beneficiario.Id}", Http.Json(new
        {
            NomeCompleto = beneficiario.NomeCompleto,
            DataNascimento = beneficiario.DataNascimento.ToString("yyyy-MM-dd"),
            PlanoId = Planos.Prata,
            Status = "ATIVO"
        }));

        Assert.Equal(HttpStatusCode.UnprocessableEntity, resposta.StatusCode);
    }

    [Fact]
    public async Task Listar_todas_as_paginas_deve_devolver_cada_registro_exatamente_uma_vez()
    {
        var semeados = await fixture.SemearBeneficiariosAsync(12);
        var idsRecebidos = new List<Guid>();

        for (var pagina = 1; pagina <= 3; pagina++)
        {
            var corpo = await (await Client.GetAsync($"/beneficiarios?pagina={pagina}&tamanho=5")).CorpoAsync();
            idsRecebidos.AddRange(
                corpo.GetProperty("dados")
                    .EnumerateArray()
                    .Select(item => item.GetProperty("id").GetGuid()));
        }

        Assert.Equal(semeados.Count, idsRecebidos.Count);
        Assert.Equal(semeados.Count, idsRecebidos.Distinct().Count());
    }
}
