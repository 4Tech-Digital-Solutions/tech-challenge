using System.Diagnostics;
using System.Text.Json;
using Desafio.Api.Api.Contratos;
using Desafio.Api.Dominio;

namespace Desafio.Api.Api.Middlewares;

public class TratamentoDeErroMiddleware(RequestDelegate proximo, ILogger<TratamentoDeErroMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext contexto)
    {
        var cronometro = Stopwatch.StartNew();

        try
        {
            await proximo(contexto);
        }
        catch (ExcecaoDeDominio excecao)
        {
            logger.LogWarning(
                "Requisição recusada. Rota: {Rota}. Erro: {Erro}. Mensagem: {Mensagem}",
                contexto.Request.Path,
                excecao.Erro,
                excecao.Message);

            await EscreverAsync(contexto, excecao.StatusCode, ErroResponse.De(excecao));
        }
        catch (Exception excecao)
        {
            logger.LogError(
                excecao,
                "Falha não tratada. Rota: {Rota}. Método: {Metodo}",
                contexto.Request.Path,
                contexto.Request.Method);

            var resposta = new ErroResponse(
                "ErroInterno",
                "Erro interno ao processar a requisição",
                []);

            await EscreverAsync(contexto, StatusCodes.Status500InternalServerError, resposta);
        }
        finally
        {
            logger.LogInformation(
                "Requisição concluída. Método: {Metodo}. Rota: {Rota}. Status: {Status}. DuracaoMs: {DuracaoMs}",
                contexto.Request.Method,
                contexto.Request.Path,
                contexto.Response.StatusCode,
                cronometro.ElapsedMilliseconds);
        }
    }

    private static async Task EscreverAsync(HttpContext contexto, int statusCode, ErroResponse resposta)
    {
        if (contexto.Response.HasStarted)
        {
            return;
        }

        contexto.Response.Clear();
        contexto.Response.StatusCode = statusCode;
        contexto.Response.ContentType = "application/json; charset=utf-8";

        await contexto.Response.WriteAsync(JsonSerializer.Serialize(resposta, JsonPadrao.Opcoes));
    }
}
