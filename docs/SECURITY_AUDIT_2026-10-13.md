# Auditoria de segurança — Comunidade do Rock

Data da revisão: 2026-10-13
Base analisada: commit `e63a7d4d171371a5ff7cefed0d03cd96c018a2cb` (antes desta branch).
Escopo: revisão estática do backend Express e dos fluxos de autenticação/perfil no frontend.
Restrições respeitadas: nenhuma conexão ao Layerbase, nenhuma consulta ou alteração de dados de produção, nenhuma alteração na branch `main`, nenhum deploy solicitado.

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

**Importante:** estes são passos parciais, não uma correção completa da segurança. A compatibilidade com contas legadas precisa ser testada em banco descartável. A autenticação/sessão do servidor e a autorização das rotas administrativas e de propriedade ainda não foram implementadas; portanto, esta branch não deve ser publicada nem mesclada. O login de uma conta admin existente só deve ser considerado preservado depois dos testes controlados previstos abaixo. Nenhum dado do Layerbase foi lido ou modificado por esta preparação.

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
