# Entrega — gabriel-pmtt

## 1. Resumo da entrega

Corrigi os defeitos do módulo de Beneficiários na API (.NET 10) e implementei os endpoints que faltavam (`GET /beneficiarios/{id}`, `PUT /beneficiarios/{id}` e `DELETE /beneficiarios/{id}`), além de paginação estável e filtros combináveis em `GET /beneficiarios`, seguindo o padrão do módulo de Planos.

No frontend (Angular 20), implementei o fluxo completo de Beneficiários (listagem paginada, busca por nome, filtros por situação e plano, cadastro, edição e exclusão com confirmação), separei a navegação em rotas (`/` e `/planos`) e criei componentes reutilizáveis em `src/app/ui/`.

---

## 2. Decisões

### 2.1 Defeitos que encontrei no código base

#### 1. `POST /beneficiarios` aceitava a entidade de domínio direto no corpo da requisição
- Onde: `base/backend-dotnet/src/Desafio.Api/Controllers/BeneficiariosController.cs` e `Dominio/Beneficiario.cs`
- O que estava errado: o endpoint recebia a entidade `Beneficiario` direto do JSON, permitindo que o cliente enviasse `id`, `status` e `data_cadastro`, contrariando a seção 2.3 da SPEC.
- Como percebi: leitura da SPEC comparada ao código de `PlanosController`.
- Como corrigi: criei o contrato `BeneficiarioRequest` aceitando apenas os quatro campos permitidos, fechei os setters no domínio e passei a definição de `Id`, `Status` e `DataCadastro` para o construtor da entidade.
- O que quebraria em produção: clientes conseguiriam forjar IDs, criar beneficiários já inativos ou adulterar datas de cadastro.

#### 2. Ausência de índice único no CPF e erro 400 em texto puro
- Onde: `Infraestrutura/AppDbContext.cs`, `Controllers/BeneficiariosController.cs` e `Aplicacao/BeneficiarioServico.cs`
- O que estava errado: um comentário no controller afirmava existir índice único de CPF no banco, mas ao consultar o banco dava para ver que o índice não existia. Além disso, o check prévio devolvia 400 em texto puro em vez de 409 no formato padrão de erro.
- Como percebi: inspeção direta do schema no PostgreSQL via `psql` e leitura da seção 4.1 da SPEC.
- Como corrigi: adicionei o índice único para o CPF no `AppDbContext`, gerei a migration `CpfUnico`, movi a checagem para `BeneficiarioServico` e passei a converter a violação de unicidade do Postgres em `ConflitoException`.
- O que quebraria em produção: duas requisições simultâneas com o mesmo CPF gravariam registros duplicados no banco.

#### 3. Validação incompleta de CPF
- Onde: `Dominio/Beneficiario.cs`
- O que estava errado: o código checava apenas se o CPF tinha 11 caracteres, aceitando dígitos repetidos (`11111111111`) e dígitos verificadores inválidos.
- Como percebi: leitura da seção 4.1 da SPEC comparada ao código original.
- Como corrigi: implementei a validação completa no domínio exigindo 11 dígitos numéricos, rejeitando sequências repetidas e conferindo os dois dígitos verificadores.
- O que quebraria em produção: cadastros com CPFs inválidos entrariam na base.

#### 4. `plano_id` inexistente retornando 500
- Onde: `Aplicacao/BeneficiarioServico.cs`
- O que estava errado: ao tentar criar um beneficiário com um plano inexistente ou excluído, o erro só acontecia no banco e voltava como 500.
- Como percebi: teste vermelho `Criar_com_plano_inexistente_deve_devolver_422` e logs da API.
- Como corrigi: passei a verificar antes se o plano existe no `BeneficiarioServico`, lançando `NaoProcessavelException`.
- O que quebraria em produção: erros de entrada do cliente apareceriam como falhas internas (500) nos logs e alertas.

#### 5. Bug N+1 e acesso direto ao banco em `GET /beneficiarios`
- Onde: `Controllers/BeneficiariosController.cs`
- O que estava errado: o controller injetava `AppDbContext` diretamente, devolvia a lista crua sem paginação e fazia um laço buscando o plano para cada beneficiário (N+1 queries).
- Como percebi: leitura do controller comparada à seção 3 da SPEC.
- Como corrigi: removi o `AppDbContext` do controller e movi a listagem para `BeneficiarioServico.ListarAsync`, fazendo sempre duas consultas fixas (total filtrado e página).
- O que quebraria em produção: latência alta e sobrecarga de conexões no banco conforme a tabela crescesse.

---

### 2.2 Pontos em que a especificação não definiu o comportamento

#### 1. Ordenação padrão de `GET /beneficiarios`
- O que a spec não define: qual campo ordena a listagem (pede apenas estabilidade na paginação).
- O que decidi: ordenar por nome completo em ordem alfabética, com desempate pelo ID.
- Por quê: segue a ordenação já usada em Planos e garante que nomes iguais não oscilem entre páginas.
- O que consideraria diferente: ordenar por data de cadastro decrescente se o foco fosse sempre ver os cadastros mais recentes primeiro.

#### 2. Reativação junto com alteração de dados no mesmo `PUT /beneficiarios/{id}`
- O que a spec não define: se ao reativar um beneficiário inativo é permitido atualizar os dados na mesma requisição ou só em um segundo `PUT`.
- O que decidi: permitir atualizar os dados no mesmo `PUT` que muda o status para `ATIVO`, bloqueando com 409 apenas quando continua `INATIVO` com alteração cadastral.
- Por quê: o `PUT` representa a atualização completa do recurso e simplifica o fluxo de reativação.
- O que consideraria diferente: exigir duas chamadas separadas (reativar primeiro, editar depois) se houvesse exigência de separar esses eventos em auditoria.

#### 3. Filtro opcional `busca` em `GET /beneficiarios`
- O que a spec não define: busca textual por nome na listagem.
- O que decidi: adicionar o parâmetro opcional `busca` filtrando por trecho do nome completo, combinável com `status` e `plano_id`.
- Por quê: facilita o uso da interface web sem alterar o contrato quando o parâmetro não é enviado.

---

### 2.3 Inconsistências que percebi

#### 1. Tamanho padrão de página em `GET /beneficiarios` (SPEC seção 3 vs teste público)
- A spec diz: tamanho entre 1 e 100, com padrão 10 quando ausente.
- O teste esperava: `Listar_sem_informar_tamanho_deve_devolver_20_itens_por_pagina` esperava 20.
- Segui: a SPEC (10) e ajustei o teste com comentário explicando o motivo.
- Por quê: a SPEC é o contrato explícito e define 10 tanto na tabela quanto no exemplo de resposta.

#### 2. `PUT /beneficiarios/{id}` em registro `INATIVO` (SPEC seção 2.3 vs teste público)
- A spec diz: beneficiário `INATIVO` é congelado e tentativas de alteração cadastral respondem 409.
- O teste esperava: `Atualizar_dados_de_beneficiario_inativo_deve_devolver_200` alterava o nome mantendo `INATIVO` e esperava 200.
- Segui: a SPEC (409), ajustei o teste para esperar 409 e adicionei um teste separado para reativação (200).
- Por quê: a regra está explícita na SPEC e o próprio enunciado alerta que nem todo teste público está sincronizado com ela.

---

### 2.4 Decisões técnicas

- Backend no padrão de Planos: mantive a arquitetura simples existente (domínio, serviço com `AppDbContext` e contratos em `record`) sem introduzir abstrações extras.
- Log estruturado de requisições: adicionei log estruturado no `TratamentoDeErroMiddleware` registrando método, rota, status e duração sem interpolação de string.
- Frontend com Angular 20, Signals e Tailwind v4: organizei a interface em rotas e criei componentes reutilizáveis em `src/app/ui/` (menu, select, tabela, botão, input com máscara, paginação e toast), mantendo CPF sem máscara e data em formato ISO ao enviar para a API.
- Simulador em memória para testes manuais: adicionei um menu na engrenagem da barra superior (somente em memória) para simular latência, erro 503 e popular 15 beneficiários de teste, mantendo o banco inicial zerado.

---

## 3. Uso de IA

Nível de uso: intenso (como tutora técnica e aceleradora de implementação, já que minha base principal é TypeScript, React, Node e PostgreSQL, e este foi meu primeiro contato prático com C#/.NET e Angular).

### 3.1 Ferramentas
- T3 Code + Gemini 4 Neon: usado como par de programação guiado para explicar conceitos de .NET e Angular fazendo paralelos com Node/React, revisar minhas implementações, agilizar a UI e auditar o código contra a SPEC.

### 3.2 Os 3 prompts que mais influenciaram o resultado

#### Prompt 1
```text
Minha base principal é Node/TypeScript e estou entrando nessa API em .NET agora. Me explica o papel do Program.cs, como ele liga as rotas, middlewares, injeção de serviços nos controllers e a inicialização do DB, fazendo paralelo com Express.
```
- O que aceitei: o entendimento do ciclo de vida no `Program.cs` (registro de serviços, ordem do pipeline com middleware de erro e inicialização do banco) para seguir o padrão de Planos.
- O que descartei e por quê: adicionar abstrações extras (MediatR, Repository genérico, FluentValidation) fora do padrão do código base.

#### Prompt 2
```text
Começando pelo front, queria trazer pro Angular o padrão de Compound Components que costumo usar no React (quebrar um componente em sub-partes pra montar na hora de chamar). Como faço isso do jeito certo no Angular pra menu de contexto, select e tabela?
```
- O que aceitei: a tradução do padrão usando estado compartilhado entre pai e filho, diretivas de atributo e integração com formulários reativos.
- O que descartei e por quê: calendário visual completo no campo de data (substituí por input com máscara `DD/MM/AAAA` para evitar problemas de fuso horário e facilitar a digitação).

#### Prompt 3
```text
A SPEC diz que beneficiário INATIVO fica congelado e qualquer alteração cadastral tem que responder 409, mas o teste público espera 200 mantendo INATIVO. Como eu estruturo o Atualizar na entidade pra seguir a SPEC e ainda deixar reativar?
```
- O que aceitei: seguir a SPEC (409 quando permanece inativo com alteração cadastral), permitir reativação no mesmo `PUT` e ajustar o teste público.
- O que descartei e por quê: exigir dois `PUT`s separados (um só para reativar e outro para editar os dados).

### 3.3 O que fiz sem IA
- Análise das divergências entre a SPEC e os testes públicos e a decisão de seguir a SPEC.
- Diagnóstico inicial do schema no PostgreSQL via `psql` comparando `Planos` e `Beneficiarios`.
- Direcionamento de estrutura e UX do frontend (rotas, componentes compostos, máscaras de CPF e data, simulador de rede).
- Validação manual dos fluxos no navegador e verificação da stack Docker.

### 3.4 O que ainda não domino
- APIs específicas de Angular e RxJS: a interface `ControlValueAccessor` para conectar inputs customizados aos formulários reativos e operadores mais avançados de RxJS além do básico de requisições HTTP.
- Detalhes internos do EF Core e migrations: ajustar manualmente o snapshot gerado pelas migrations ou mapeamentos mais avançados do EF Core sem consultar a documentação.

---

## 4. Perguntas de compreensão

### 4.1 Concorrência
**O que acontece se duas requisições simultâneas tentarem criar beneficiários com o mesmo CPF? Onde exatamente, na sua implementação, a unicidade é garantida?**

No `BeneficiarioServico.CriarAsync` (`base/backend-dotnet/src/Desafio.Api/Aplicacao/BeneficiarioServico.cs`), fazemos uma consulta prévia no banco para ver se o CPF já existe (incluindo beneficiários excluídos). Só que, se duas requisições chegarem juntas, as duas podem passar por essa consulta antes de qualquer uma salvar. Por isso, quem garante a unicidade de verdade é o próprio banco de dados, através do índice único no campo `Cpf` configurado em `AppDbContext.cs` e criado na migration `20261120221633_CpfUnico.cs`. O PostgreSQL deixa só a primeira gravação passar e barra a segunda por duplicidade. No `BeneficiarioServico.SalvarAsync`, capturamos esse erro do banco e devolvemos `409 Conflict` via `ConflitoException`. Esse cenário está validado no teste `Criar_com_mesmo_cpf_simultaneamente_deve_criar_apenas_um`, que dispara duas requisições juntas e confirma um `201` e um `409`.

### 4.2 Um defeito que você corrigiu
**Escolha um dos defeitos que encontrou no código base e explique: por que o código original estava errado, e em que situação real ele quebraria em produção?**

No `BeneficiariosController.cs` original, o `GET /beneficiarios` acessava o `AppDbContext` diretamente e, depois de buscar a lista de beneficiários, percorria cada item fazendo uma nova consulta ao banco para carregar o plano, além de não paginar nem devolver o envelope esperado. Isso causava o problema de N+1 queries: para listar 100 beneficiários, a API fazia 101 idas ao banco, quebrando a regra da seção 3 da SPEC. Em produção, conforme o cadastro crescesse, uma tela simples de listagem deixaria o banco lento e sobrecarregado. Corrigi tirando o acesso ao banco do controller e levando a listagem para `BeneficiarioServico.ListarAsync`, que agora aplica os filtros e faz sempre apenas duas consultas fixas: uma para contar o total e outra para buscar só os itens da página atual.

### 4.3 O trecho mais complexo
**Escolha o trecho mais complexo que a IA gerou para você, ou o trecho mais complexo do projeto se você não usou IA, e explique linha a linha o que ele faz.**

Escolhi o método `Atualizar` em `base/backend-dotnet/src/Desafio.Api/Dominio/Beneficiario.cs` (linhas 60 a 94), porque concentra a regra de congelamento do beneficiário inativo junto com a validação completa do `PUT`:

```csharp
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
```

Na linha 66, ele cria a lista `detalhes` para acumular todos os erros de validação e devolver tudo de uma vez. Nas linhas 68 a 75, valida se `status` veio nulo ou fora dos valores válidos do enum. Nas linhas 78 a 90, aplica a regra do registro congelado: só entra no bloco se o beneficiário já está inativo e o payload mantém inativo. Ali ele remove espaços extras do nome e compara nome, data de nascimento e plano com os valores atuais; se qualquer um mudou, lança `ConflitoException` (409). Se o payload estiver reativando o beneficiário, esse bloco não roda e a atualização segue. Na linha 92, `DefinirDados` valida os demais campos, soma eventuais erros na mesma lista e, se houver qualquer erro, lança `ValidacaoException` (400) antes de alterar o objeto. Só na linha 93, depois de passar pelas validações, o `Status` é atualizado.
