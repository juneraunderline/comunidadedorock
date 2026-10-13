# Auditoria de segurança — Comunidade do Rock

Data da revisão: 2026-10-13
Base analisada: commit `e63a7d4d171371a5ff7cefed0d03cd96c018a2cb` (antes desta branch).
Escopo: revisão estática do backend Express e dos fluxos de autenticação/perfil no frontend.
Restrições: a branch `main` não foi alterada e nenhum merge/deploy foi iniciado. Não houve conexão direta nem consulta SQL manual ao Layerbase. Durante a checagem final, porém, foram feitas requisições HTTP GET públicas para o site, `/api/health`, `/api/bands` e `/api/events`. Pelo comportamento do código, `/api/health` pode inicializar o esquema e `/api/bands` pode migrar imagens legadas; portanto, não é possível garantir ausência de efeitos indiretos no banco. Nenhuma rota de escrita foi chamada intencionalmente. Não repetir chamadas de produção; manter o restante da validação no banco descartável.

> Esta é uma revisão estática preliminar, não um pentest nem uma confirmação de exploração em produção. Os itens abaixo devem ser verificados por testes controlados antes de afirmar que foram corrigidos.

## Resumo executivo

**Risco geral preliminar: crítico.** Há múltiplas rotas de escrita e administração sem middleware de autenticação/autorização visível no arquivo de backend analisado. Também há senha em texto puro e criação automática de administrador com credencial padrão. A primeira prioridade é implantar autenticação de servidor compatível com o frontend atual, e só depois restringir rotas — fazer apenas bloqueios isolados agora pode quebrar o painel e os fluxos existentes.

## Achados

### SEC-01 — Rotas administrativas e de escrita sem autorização visível (CRÍTICO)

Em `backend/server.js`, os handlers abaixo não mostram verificação de sessão/identidade e papel administrativo antes de executar ações:
- Conteúdo: `POST/PUT/DELETE /api/posts`, `DELETE /api/posts-without-images`.
- Bandas: `POST/PUT/DELETE /api/bands`, `POST /api/bands/:id/weekly-featured`, `GET /api/pending-bands`, `POST /api/approve-band/:id`, `DELETE /api/pending-bands/:id`.
- Entrevistas e lançamentos: `POST/PUT/DELETE /api/interviews`, `POST/PUT/DELETE /api/releases`.
- Eventos: `POST /api/events`, `PUT/DELETE /api/events/:id`, `PUT /api/events/:id/status`. Existe também um fluxo público separado `POST /api/event-submissions`; confirmar que submissões públicas só criam itens pendentes.
- Usuários: `GET /api/users`, `PUT /api/user/:id/role`, `DELETE /api/user/:id`.
- RSS/manutenção: `POST/PUT/DELETE /api/rss-feeds`, `POST /api/import-rss`, `POST /api/import-rss-single`, `POST /api/reimport-rss`, `POST /api/fix-html-entities`, `POST /api/fix-missing-images`, `POST /api/test-rss-images`, `POST /api/cleanup-duplicates`.

Impacto possível: criação, edição ou exclusão não autorizada de conteúdo, alteração de privilégios, acesso a dados de usuários e execução de tarefas de manutenção por chamadas diretas à API.

Correção necessária: autenticação validada no servidor em cada pedido privado, autorização por papel (admin/editor/user) e política explícita por rota. Não confiar em `localStorage`, IDs enviados pelo cliente ou ocultação de botões no frontend.

### SEC-02 — Senhas em texto puro (CRÍTICO)

`POST /api/register` grava o valor recebido diretamente em `users.password`; `POST /api/login` compara a senha diretamente com o banco; a alteração de senha segue o mesmo modelo.

Impacto possível: exposição imediata das senhas caso o banco, backup ou logs sejam acessados.

Correção necessária: adotar hash de senha moderno (preferência Argon2id; alternativa scrypt/bcrypt adequada ao ambiente), com migração compatível de contas legadas e rehash após autenticação bem-sucedida. Não redefinir nem apagar senhas em lote. Criar plano de recuperação para contas que não possam ser migradas.

### SEC-03 — Credencial padrão de administrador criada automaticamente (CRÍTICO)

No login, se não houver usuário `admin`, o backend insere uma conta com senha fixa `1234`. A rotina também exclui duplicatas de `admin` automaticamente.

Impacto possível: criação de acesso administrativo previsível em banco vazio/estado inesperado e alteração destrutiva automática de contas duplicadas.

Correção necessária: remover a criação por credencial padrão; exigir bootstrap administrativo explícito e seguro via segredo de ambiente/rotina de manutenção controlada. Não excluir contas automaticamente. Antes da mudança, verificar e preservar a conta administrativa atual sem revelar nem solicitar senha no código.

### SEC-04 — IDOR / falta de vínculo entre usuário e perfil (ALTO)

`GET /api/user/:id` e `PUT /api/user/:id` consultam o ID do caminho sem autenticar visivelmente a pessoa solicitante. O endpoint PUT permite editar perfil e senha com base no ID alvo, sem vínculo de sessão verificado no handler.

Correção necessária: exigir sessão válida; usuário comum só pode ler/editar a própria conta; somente administrador autorizado pode operar em outras contas. Mudança de senha deve validar a senha atual depois de confirmar a identidade.

### SEC-05 — Upload de imagem exposto e limites de payload excessivos (ALTO)

`POST /api/upload-image` aceita imagem do corpo sem autenticação visível e o Express permite JSON/URL-encoded de até 50 MB. A rota pode consumir recursos e quota do Cloudinary.

Correção necessária: autenticar conforme o caso de uso, validar MIME real e tamanho/dimensões, limitar payload ao necessário e aplicar rate limit. Separar uploads públicos legítimos de uploads de administração se necessário.

### SEC-06 — Comentários aceitam identidade fornecida pelo cliente (ALTO)

`POST /api/comments` aceita `user_id`, `user_name` e `user_avatar` do corpo e insere esses valores sem comprovar que correspondem a uma conta autenticada. A exclusão `DELETE /api/comments/:id` não mostra verificação de administrador ou dono.

Correção necessária: derivar identidade da sessão no servidor; permitir exclusão apenas ao autor autenticado ou a moderador/admin autorizado; validar tipo e faixa de `page_id`, sanitizar/escapar saída e considerar rate limit/moderação antispam.

### SEC-07 — CORS permissivo e ausência de política de sessão explícita (ALTO)

O backend usa `app.use(cors())` sem origem explicitamente restrita e não há sistema de sessão/token confiável visível no login; o frontend salva o objeto de usuário em `localStorage`. Esse objeto não prova identidade ao backend.

Correção necessária: escolher mecanismo de sessão seguro compatível com frontend e domínio da API (preferir cookie HttpOnly/Secure/SameSite adequado e proteção CSRF quando aplicável); configurar CORS com origens permitidas explícitas e credenciais somente após validar o desenho. Não colocar segredos de sessão no `localStorage`.

### SEC-08 — Mensagens de erro podem revelar detalhes internos (MÉDIO)

Várias rotas retornam `err.message` diretamente ao cliente.

Correção necessária: mensagens genéricas para o cliente, logs de servidor sem credenciais/tokens/dados sensíveis e identificador de correlação para diagnóstico.

### SEC-09 — Validação, abuso e consumo de recursos (MÉDIO)

Não foi identificado rate limit global para login/cadastro/upload/comentários; limites de JSON são altos; há rotas de manutenção com efeitos extensos sem autorização visível. A validação de entrada varia por endpoint.

Correção necessária: limites específicos por rota, rate limiting, validação de esquema, tamanho e tipo, timeout e proteção de tarefas de manutenção.

### SEC-10 — Verificação de saúde e tarefas agendadas (REVISAR)

`GET /api/health` e `GET /api/cron/rss` existem. O cron já compara `Authorization: Bearer` com `CRON_SECRET`, o que é uma proteção positiva. Confirmar que o segredo existe na Vercel e que a rota de saúde não expõe stack trace ou configuração sensível. Não imprimir valores secretos em logs.

## Estado da branch após a preparação inicial

Commits adicionais nesta branch:
- `d71dc6f`: novos cadastros armazenam senhas com scrypt; login verifica senha com comparação de hash e migra senha legada após autenticação válida; alteração de senha armazena hash; removida a criação automática de `admin/1234` e a exclusão automática de contas admin duplicadas.
- `912ad58` e `b5ff0f0`: mensagens e validação visual de cadastro/troca de senha alinhadas ao mínimo de 8 caracteres.

**Estado atualizado:** a branch já contém autenticação por token de sessão no servidor, autorização central por rota/papel e testes de integração contra PostgreSQL descartável. A execução nº 13 do GitHub Actions passou. Novas verificações de rate limiting, sanitização de HTML e cabeçalhos de segurança foram adicionadas depois dessa execução e ainda precisam concluir no CI. Esta branch continua isolada: não publicar nem mesclar até a execução final passar e até revisar as limitações descritas no fim deste relatório. Não houve conexão direta ao Layerbase; consulte a ressalva operacional no início deste relatório sobre as chamadas HTTP públicas e seus possíveis efeitos indiretos.

## Plano de correção — sem tocar em produção

### Fase A — Preparação (esta branch)
- Registrar os achados e o plano de teste.
- Não alterar `main`, Layerbase ou configurações Vercel.
- Não publicar nem fazer merge automaticamente.

### Fase B — Autenticação e autorização
1. Definir sessão de servidor e contrato de autenticação entre frontend e API.
2. Garantir migração compatível de senhas legadas para hashes.
3. Remover criação de administrador com senha padrão e exclusão automática de duplicatas.
4. Implementar middleware `requireAuth`, `requireRole` e verificação de propriedade.
5. Aplicar política de acesso rota por rota; manter públicas apenas as rotas intencionalmente públicas (leitura, cadastro, submissões pendentes e health check minimizado).
6. Corrigir CORS/CSRF de acordo com o mecanismo de sessão.
7. Proteger upload, comentários, tarefas RSS e manutenção.

### Fase C — Testes isolados
Executar primeiro em ambiente de teste com banco descartável e credenciais fictícias. Não apontar testes de escrita para Layerbase de produção.

## Matriz de testes obrigatórios antes de qualquer publicação

| Cenário | Resultado esperado |
|---|---|
| Login com credenciais válidas de usuário comum | Login permitido; sessão segura emitida |
| Login inválido | 401 genérico; sem dados sensíveis |
| Senha legada válida durante migração | Login permitido e hash atualizado sem reset |
| Conta admin existente | Continua acessível com as credenciais atuais; sem criação/remoção automática de contas |
| Usuário comum chama `PUT /api/user/:id/role` | 401/403; papel não muda |
| Sem sessão chama POST/PUT/DELETE de posts, bandas, eventos, entrevistas, releases ou feeds | 401/403; banco de teste permanece inalterado |
| Editor tenta operação exclusiva de admin | 403 |
| Usuário A altera ou exclui perfil/comentário do usuário B | 403; dados não mudam |
| Usuário autenticado atualiza o próprio perfil | Sucesso somente nos campos permitidos |
| Upload sem sessão, payload excessivo ou arquivo inválido | Rejeitado sem consumo indevido do serviço |
| Comentário com identidade falsificada | Identidade derivada da sessão ou pedido rejeitado |
| Origem web não permitida | Rejeitada conforme política CORS |
| Logout | Sessão invalidada e ações privadas bloqueadas |
| CRUD autorizado do painel | Continua funcionando para o papel correto |
| Rotas públicas de notícias, bandas, entrevistas, eventos e RSS | Leitura pública continua funcionando |
| Cron RSS com segredo correto/incorreto | Correto autorizado; incorreto 401 |
| Build frontend/backend e testes automatizados | Passam antes de qualquer publicação |

## Critério de liberação

Nenhum merge ou deploy até: revisão do diff, testes automatizados aprovados, teste manual dos fluxos de login/admin, confirmação de que a conta admin foi preservada e aprovação explícita. A execução dos testes deve usar banco isolado; nenhum teste destrutivo em Layerbase de produção.


## Implementação em andamento na branch isolada

Commits de implementação adicionados após a preparação inicial:

- `7f3dee1`: criação de sessões de servidor com tokens aleatórios de 256 bits, validade de 8 horas e armazenamento apenas do SHA-256 do token no PostgreSQL.
- `80cd328`: validação de sessão e logout com revogação no servidor.
- `9fbb1b3`: CORS restrito às origens configuradas e redução do limite de JSON para 10 MB / URL-encoded para 1 MB.
- `f580c37`, `3546c60`, `3510f99`, `aabb0f1` e `e5b36f8`: token enviado nas chamadas do frontend, validação da sessão ao abrir o site, logout e preservação do estado local em falhas transitórias da API.
- `406d9b8`: workflow de CI isolado para verificar sintaxe do backend e build do frontend; não publica nem faz deploy.
- `b95fa03`: resposta pública do health check minimizada.

### Política de autorização implementada nesta etapa

- Leitura pública permanece disponível para notícias, bandas, entrevistas, lançamentos, eventos aprovados, feeds RSS e comentários.
- Login e cadastro público permanecem acessíveis; novo cadastro exige senha de pelo menos 8 caracteres.
- Envio de banda continua público e grava em fila pendente; submissão de evento exige sessão autenticada.
- Perfil só pode ser acessado/editado pelo próprio usuário ou por admin.
- Escritas de posts, entrevistas e lançamentos exigem admin/editor.
- Escritas de bandas/eventos, gerenciamento de usuários, feeds RSS, aprovação/rejeição, tarefas de manutenção e dados administrativos exigem admin.
- Upload exige sessão autenticada.
- Comentários exigem sessão; o autor e avatar são derivados da conta autenticada, não do corpo enviado pelo navegador. Exclusão só pelo autor ou admin/editor.
- O cron RSS mantém sua verificação separada por `CRON_SECRET`.
- As sessões são revogáveis no logout e ao excluir usuário; a expiração é verificada no servidor.

### Bloqueios e ressalvas ainda existentes

1. **Nenhum teste foi executado nesta sessão.** O workflow foi preparado, mas seu resultado precisa ser observado no GitHub Actions. O build e a sintaxe não devem ser considerados aprovados antes de aparecerem como sucesso.
2. O teste real de login, migração de senhas legadas, conta administrativa existente, permissões e CRUD ainda exige um banco descartável e credenciais fictícias. Não houve conexão direta ao Layerbase; consulte a ressalva operacional no início deste relatório sobre as chamadas HTTP públicas e seus possíveis efeitos indiretos. Não apontar testes de escrita para produção.
3. O token do SPA fica em `localStorage`; é enviado como Bearer e não é usado o objeto de usuário como prova de identidade, mas XSS ainda pode expor tokens. Uma fase posterior deve revisar a prevenção de XSS/CSP e decidir se uma arquitetura de cookie HttpOnly é viável entre o domínio `.com.br` e a API `.vercel.app`.
4. O CORS usa `FRONTEND_ORIGINS` como lista separada por vírgulas; o padrão contém o domínio de produção e `localhost:5173`. Antes de testar um preview, configurar suas origens explicitamente. Não usar curingas.
5. A criação da tabela `auth_sessions` ocorre durante a inicialização normal do backend quando este código for executado. Isso **não foi executado aqui**. Qualquer futura publicação precisará revisar essa migração de schema; esta branch não foi mesclada e nenhum deploy foi iniciado.
6. A verificação de autorização central é uma primeira camada e precisa de teste rota por rota contra o painel real. Não declarar esta branch pronta para produção antes da revisão humana e da matriz de testes abaixo.

### Estado atual

A branch contém implementação de sessão e política central de autorização, mas **continua não liberada para produção**. Não houve merge, deploy manual ou alteração na `main`. A ressalva sobre chamadas HTTP públicas e possíveis efeitos indiretos está registrada no início deste relatório. O workflow de CI está limitado a esta branch e a pull requests para `main`; ele executa verificações de sintaxe/build, não testes de integração de autenticação.

## Atualização de 13/10/2026 — testes de integração isolados

- A resposta do middleware de inicialização agora retorna uma mensagem genérica ao cliente; detalhes técnicos permanecem somente nos logs do servidor.
- Foi criado `backend/tests/security.integration.test.js` para testar login e migração de senha legada, emissão de sessão, acesso por papel, isolamento de perfis, criação e exclusão de comentários, proteção de upload, leitura pública de eventos e revogação de sessão no logout.
- O workflow `.github/workflows/security-checks.yml` agora provisiona um serviço PostgreSQL 16 descartável dentro do GitHub Actions e executa os testes contra `cdr_test`. As credenciais são exclusivamente de teste e não apontam para Layerbase.
- Execução de CI com os testes integrados: https://github.com/juneraunderline/comunidadedorock/actions/runs/38468389074
- **A aprovação dessa execução ainda precisa ser confirmada.** Não considerar os testes integrados aprovados enquanto o job não terminar com conclusão `success`.
- Nenhum deploy ou merge foi feito. A branch continua separada da `main`.


## Atualização complementar — 2026-10-13

### Proteções adicionais adicionadas à branch

- **Rate limiting:** limite geral de 180 requisições por minuto à API por IP; 10 tentativas em 15 minutos nos endpoints de login/cadastro; 15 envios de imagem em 15 minutos; 20 interações em 15 minutos para comentários e submissões de eventos.
- **XSS em conteúdo HTML:** `DOMPurify` é aplicado antes de renderizar HTML de notícias e entrevistas, nos dois pontos encontrados com `dangerouslySetInnerHTML`.
- **Cabeçalhos do frontend:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` e HSTS.
- **Cabeçalhos da API:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`.
- **Teste automatizado:** foi incluído cenário que verifica que tentativas repetidas de login passam a receber HTTP 429.

### Limitações que continuam abertas

1. O armazenamento padrão do `express-rate-limit` é em memória por instância. Em Vercel serverless, isso reduz abusos repetidos na mesma instância, mas não constitui um limite global distribuído entre todas as instâncias. Uma solução compartilhada (Redis/serviço equivalente) exigiria configuração e credenciais adicionais; não foi conectada nesta branch.
2. O token de sessão ainda fica no `localStorage`; portanto, um XSS em qualquer outro ponto da aplicação ainda poderia tentar roubá-lo. Sanitizar os dois pontos de HTML conhecidos reduz um vetor importante, mas não substitui uma revisão completa de todos os usos de HTML/URLs nem uma migração futura para cookie `HttpOnly` com proteção CSRF.
3. Não foi imposto um CSP restritivo nesta etapa porque o frontend usa Google AdSense e embeds externos; uma política incompatível poderia quebrar anúncios ou conteúdo incorporado. O CSP deve ser introduzido em modo de relatório e testado antes de bloquear recursos.
4. Os cabeçalhos, sanitização e limites novos precisam passar pelo CI. Os limites são heurísticos e podem precisar de ajuste depois de testes funcionais; nenhuma mudança foi publicada em produção.
5. Nenhum teste de ponta a ponta no navegador foi executado. Houve apenas smoke checks HTTP públicos de GET; eles não validam fluxos de interface e seus possíveis efeitos indiretos estão descritos no início deste relatório. Os testes automatizados usam exclusivamente o banco efêmero e descartável `cdr_test`.

**Regra de publicação:** não mesclar nem implantar esta branch até o workflow mais recente concluir com sucesso, revisar os testes de regressão do painel/admin e planejar uma publicação controlada com rollback.

## Atualização complementar — revisão de permissões e abuso de formulários

- Adicionado limite dedicado ao endpoint público `POST /api/bands/submit`: 5 tentativas por IP em 15 minutos. O formulário continua público e as submissões válidas continuam no fluxo de aprovação, mas chamadas repetidas passam a receber HTTP 429.
- A suíte de integração agora verifica que um editor consegue criar, editar e excluir uma notícia no PostgreSQL descartável, que usuário comum não consegue publicar notícia, que editor não acessa a listagem administrativa completa de eventos nem administra feeds RSS e que a administração continua acessando a listagem completa de eventos.
- Incluídos testes de bloqueio de acesso a bandas pendentes e de limite de submissões públicas de bandas.
- Todos os testes automatizados continuam apontados exclusivamente ao PostgreSQL efêmero `cdr_test`; eles não consultam nem alteram Layerbase. A ressalva sobre as chamadas HTTP públicas de verificação está registrada no início deste relatório.
- **Estado:** estas mudanças precisam passar pelo GitHub Actions antes de serem consideradas verificadas. Não houve merge nem deploy.


## Verificação de CI e revisão do painel — 13/10/2026

- O workflow da revisão anterior terminou com **success**: [execução #26](https://github.com/juneraunderline/comunidadedorock/actions/runs/38471576639). O log confirma a execução de `backend/tests/security.integration.test.js`, com saída `PASS`, e o build do frontend terminou sem falha. Permanecem avisos de dependências/chunk size, não erros que tenham falhado esse job.
- Na revisão do painel `frontend/src/Admin.jsx`, identifiquei as leituras disparadas ao abrir o painel: notícias, bandas, bandas pendentes, entrevistas, eventos, lançamentos, feeds RSS, status RSS e usuários. Acrescentei verificações de que a conta **admin fictícia** consegue ler todos esses endpoints no PostgreSQL descartável.
- O teste adicional foi enviado à mesma branch isolada no commit `c681168e4e48de27c82324536ec8fa2f9639fe1d`. A nova execução de CI precisa terminar com sucesso antes de considerar essa cobertura aprovada.
- Os testes exercitam a API com dados e credenciais fictícios. Isso confirma compatibilidade dos endpoints de leitura do painel no backend, mas **não substitui um teste visual/end-to-end do painel no navegador**. Não entrei na conta administrativa real nem alterei a senha.
- **Ainda não liberar para produção:** aguardar o novo workflow e fazer a validação manual controlada dos fluxos de escrita do painel (criar/editar/excluir notícia, banda, entrevista, lançamento e evento; moderar cadastro de banda/evento; gerir RSS e usuários). Isso deve ocorrer em ambiente de teste ou preview, não diretamente na produção.
- Não houve merge, deploy ou alteração da branch `main`. A ressalva operacional sobre chamadas HTTP públicas e possíveis efeitos indiretos está registrada no início deste relatório.
