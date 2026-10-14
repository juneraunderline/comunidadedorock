# Auditoria de segurança — continuação (2026-10-14)

Branch: `security/audit-hardening-2026-10`

## Estado e restrições
- Trabalho isolado nesta branch.
- Não alterar `main`, não fazer merge e não iniciar deploy/preview.
- Não executar migrações nem escrever na base Layerbase de produção.
- Não redefinir senha nem alterar a conta administrativa existente.
- Não criar serviços ou bancos pagos.

## Validação do estado atual do código

### 1. Rate limit compartilhado entre instâncias serverless — PENDENTE
O backend usa `express-rate-limit` sem `store` explícito nos limitadores global, autenticação, upload, interação e inscrição de bandas. O armazenamento padrão é em memória, portanto cada instância serverless mantém seus próprios contadores. Os limites atuais não são globais entre instâncias.

**Correção necessária:** armazenar contadores atomicamente num backend compartilhado, preferencialmente PostgreSQL/Layerbase existente, com chave por rota + IP normalizado + janela. A tabela deve ter expiração/limpeza controlada, limites de tamanho e comportamento definido quando o banco falhar. A implementação precisa evitar DDL por requisição, preservar os limites atuais e não expor IPs em logs. Antes de integrar, criar testes concorrentes para garantir que duas instâncias simuladas compartilhem o mesmo contador.

**Bloqueio de publicação:** não considerar este requisito atendido até testes de concorrência passarem. Não usar memória local como fallback silencioso, pois isso daria uma falsa garantia de limite compartilhado.

### 2. Sessões e conta administrativa real — PARCIAL / AGUARDA VALIDAÇÃO CONTROLADA
O código da branch cria `auth_sessions` com hash único do token, referência a usuário, expiração e índices. A migração de senha para scrypt ocorre após autenticação válida, preservando a senha antiga até um login bem-sucedido. O código sozinho não comprova que a conta administrativa real consegue autenticar nem que as sessões antigas foram migradas sem perda.

**Validação necessária sem alteração de dados:** testar em ambiente isolado com cópia sanitizada/sintética dos formatos de sessão e senha; verificar login, sessão, logout, expiração, revogação após troca de senha e autorização admin/editor/usuário. Confirmar a identidade da conta administrativa por metadados não secretos e validar o fluxo com o responsável autenticando-se manualmente. Não registrar nem solicitar senha, token de sessão ou segredo no relatório.

**Bloqueio de publicação:** não afirmar que a conta real foi validada sem teste autenticado autorizado; não resetar credenciais nem alterar permissões para facilitar o teste.

### 3. Imagens comprimidas na fila de inscrições — PROTEÇÕES PARCIAIS
A função `preparePendingBandImage` limita o payload recebido a 7 MiB de string, o binário a 5 MiB, limita dimensões a 25 milhões de pixels, confere formato real e tenta comprimir a imagem para no máximo 1 MiB. A imagem fica em Base64 no registro pendente até a aprovação, sem upload antecipado ao Cloudinary.

**Riscos restantes:** limite por inscrição/IP não controla o total acumulado na tabela; não foi comprovada uma política de retenção para inscrições abandonadas; Base64 aumenta o tamanho armazenado; é preciso confirmar se o corpo JSON de 10 MiB permite uma mensagem de erro clara antes de consumir CPU/memória em excesso. Não excluir automaticamente inscrições pendentes legítimas sem política aprovada.

**Correção/testes necessários:** estabelecer limite por IP para inscrições e bytes agregados por janela, impor limite de tamanho de corpo compatível com a imagem comprimida, testar imagens inválidas/pixel bombs e payloads malformados, e propor retenção explícita (por exemplo, expiração após período acordado) antes de qualquer exclusão. Medir tamanho armazenado e assegurar que falha no processamento não persiste Base64 original.

## Matriz de testes para fechamento

| Teste | Estado |
|---|---|
| Testes de autenticação/autorização já executados na branch | Aprovado anteriormente; repetir após mudanças |
| Teste visual básico | Aprovado anteriormente; não prova funcionamento integral do painel |
| Rate limit consistente entre duas instâncias | Pendente |
| Concorrência/atomicidade dos contadores compartilhados | Pendente |
| Login da conta administrativa real, sem reset de senha | Pendente — requer validação autorizada |
| Migração de sessão e logout/revogação | Pendente em ambiente isolado |
| Payload de imagem acima do limite e Base64 inválido | Pendente |
| Limite agregado e retenção da fila pendente | Pendente |
| Compatibilidade completa do painel administrativo | Pendente |
| Dependência Playwright com alerta de severidade alta | Pendente — avaliar correção compatível e reexecutar testes |

## Critério de encerramento
Só marcar a auditoria como aprovada após testes reproduzíveis e evidências anexadas. Até lá, manter branch isolada e não publicar. Nenhum teste desta etapa deve apontar para Layerbase de produção ou provocar deploy.
