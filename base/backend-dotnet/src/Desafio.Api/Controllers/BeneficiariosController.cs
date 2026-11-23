using Desafio.Api.Api.Contratos;
using Desafio.Api.Aplicacao;
using Desafio.Api.Dominio;
using Microsoft.AspNetCore.Mvc;

namespace Desafio.Api.Controllers;

[ApiController]
[Route("beneficiarios")]
[Produces("application/json")]
public class BeneficiariosController(BeneficiarioServico servico) : ControllerBase
{
    [HttpGet("{id:guid}")]
    [ProducesResponseType<BeneficiarioResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obter(Guid id, CancellationToken cancellationToken)
    {
        var beneficiario = await servico.ObterAsync(id, cancellationToken);

        return Ok(BeneficiarioResponse.De(beneficiario));
    }

    [HttpPost]
    [ProducesResponseType<BeneficiarioResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Criar([FromBody] BeneficiarioRequest request, CancellationToken cancellationToken)
    {
        var dados = new BeneficiarioRequestDados(request.NomeCompleto, request.Cpf, request.DataNascimento, request.PlanoId);
        var beneficiario = await servico.CriarAsync(dados, cancellationToken);

        return CreatedAtAction(nameof(Obter), new { id = beneficiario.Id }, BeneficiarioResponse.De(beneficiario));

    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<BeneficiarioResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Atualizar(Guid id, [FromBody] AtualizarBeneficiarioRequest request, CancellationToken cancellationToken)
    {
        var dados = new AtualizarBeneficiarioDados(request.NomeCompleto, request.DataNascimento, request.PlanoId, request.Status);
        var beneficiario = await servico.AtualizarAsync(id, dados, cancellationToken);

        return Ok(BeneficiarioResponse.De(beneficiario));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Excluir(Guid id, CancellationToken cancellationToken)
    {
        await servico.ExcluirAsync(id, cancellationToken);

        return NoContent();
    }

    [HttpGet]
    [ProducesResponseType<BeneficiariosPaginadosResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ErroResponse>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Listar(
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanho = 10,
        [FromQuery] StatusBeneficiario? status = null,
        [FromQuery(Name = "plano_id")] Guid? planoId = null,
        [FromQuery] string? busca = null,
        CancellationToken cancellationToken = default)
    {
        var filtro = new ListarBeneficiariosFiltro(pagina, tamanho, status, planoId, busca);
        var resultado = await servico.ListarAsync(filtro, cancellationToken);
        var dados = resultado.Dados.Select(BeneficiarioResponse.De).ToList();

        return Ok(new BeneficiariosPaginadosResponse(dados, resultado.Pagina, resultado.Tamanho, resultado.Total));
    }
}
