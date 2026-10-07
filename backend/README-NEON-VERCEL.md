# Migração do Comunidade do Rock para Neon + Vercel

## Arquitetura nova

- Frontend React/Vite → Vercel
- Backend Express → Vercel
- Banco PostgreSQL → Neon
- Imagens → Cloudinary
- Código → GitHub

O backend já usa PostgreSQL e `DATABASE_URL`, então não é necessário converter o banco para outro tipo.

## Dados preservados

O script `scripts/migrate-to-neon.js` copia os registros das 8 tabelas atuais:

- posts
- bands
- pending_bands
- rss_feeds
- events
- interviews
- users
- comments

Os IDs são preservados e as sequências `SERIAL` são reajustadas. A origem nunca recebe INSERT, UPDATE ou DELETE.

## Executar a migração

Na pasta `backend`:

```bash
SOURCE_DATABASE_URL="CONEXAO_POSTGRES_ATUAL" \
TARGET_DATABASE_URL="CONEXAO_NEON" \
node scripts/migrate-to-neon.js
```

Use a conexão pooled do Neon para a aplicação Vercel.

> Nunca coloque essas strings de conexão no GitHub, em arquivos `.js` ou em prints.

## Variáveis do backend Vercel

Configure:

- `DATABASE_URL` = conexão pooled do Neon
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PUBLIC_API_URL` = URL pública do backend Vercel
- `CRON_SECRET` = segredo para o endpoint de importação RSS

## RSS

O Fly mantinha um `setInterval` no servidor. Em Vercel não devemos depender de timers de processo para tarefas periódicas. O endpoint `GET /api/cron/rss` foi preparado para ser acionado por um agendador externo.

Podemos usar GitHub Actions para chamar esse endpoint periodicamente sem depender do Fly.

## Imagens

A migração do PostgreSQL preserva os URLs gravados nas colunas de imagem. Imagens já hospedadas no Cloudinary continuam funcionando.

Arquivos que existissem somente no disco local do Fly (por exemplo `/images/arquivo.jpg`) precisam ser copiados separadamente, porque o disco local não é armazenamento persistente adequado para Vercel.
