const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { Client } = require("pg");

const port = 4317;
const base = "http://127.0.0.1:" + port;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.includes("cdr_test")) {
  throw new Error("Testes exigem DATABASE_URL apontando explicitamente para o banco descartável cdr_test.");
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: __dirname + "/..",
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", data => process.stdout.write("[backend] " + data));
server.stderr.on("data", data => process.stderr.write("[backend] " + data));

async function request(path, options = {}) {
  const method = options.method || "GET";
  const token = options.token;
  const body = options.body;
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}
  return { status: response.status, data, headers: response.headers };
}

async function waitForServer() {
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error("Backend encerrou durante a inicialização (exit " + server.exitCode + ").");
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Backend de teste não ficou pronto em 45 segundos.");
}

(async () => {
  let client;
  try {
    await waitForServer();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // Banco PostgreSQL efêmero do job; nunca usar credenciais reais.
    const adminName = "security-test-admin";
    const adminPass = "Legacy-Admin-123!";
    await client.query("DELETE FROM users WHERE username IN ($1, $2, $3, $4)", [adminName, "security-test-user", "security-test-other", "security-test-editor"]);
    const inserted = await client.query(
      "INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
      [adminName, adminPass, "Admin de Teste"]
    );
    const adminId = inserted.rows[0].id;

    const unauthUsers = await request("/api/users");
    assert.equal(unauthUsers.status, 401, "lista de usuários deve exigir autenticação");

    // Cabeçalhos de segurança e política CORS: a origem permitida recebe ACAO;
    // uma origem externa não recebe autorização de leitura cross-origin.
    const allowedOrigin = "https://comunidadedorock.com.br";
    const healthAllowed = await fetch(base + "/api/health", { headers: { Origin: allowedOrigin } });
    assert.equal(healthAllowed.status, 200, "health deve responder para origem autorizada");
    assert.equal(healthAllowed.headers.get("access-control-allow-origin"), allowedOrigin, "CORS deve refletir apenas a origem autorizada");
    assert.equal(healthAllowed.headers.get("x-content-type-options"), "nosniff", "API deve incluir X-Content-Type-Options");
    assert.equal(healthAllowed.headers.get("x-frame-options"), "DENY", "API deve impedir enquadramento");
    const healthBlocked = await fetch(base + "/api/health", { headers: { Origin: "https://evil.example" } });
    assert.equal(healthBlocked.headers.get("access-control-allow-origin"), null, "origem externa não deve receber autorização CORS");


    const adminLogin = await request("/api/login", { method: "POST", body: { user: adminName, pass: adminPass } });
    assert.equal(adminLogin.status, 200, "admin legado deve conseguir entrar com a senha atual");
    assert.ok(adminLogin.data.token, "login deve emitir token");
    const migrated = await client.query("SELECT password FROM users WHERE id = $1", [adminId]);
    assert.match(migrated.rows[0].password, /^scrypt\$/, "senha legada deve migrar para scrypt após login válido");
    const adminToken = adminLogin.data.token;

    const malformedProfile = await request("/api/user/not-an-id", { token: adminToken });
    assert.equal(malformedProfile.status, 500, "ID de perfil malformado deve falhar sem sucesso");
    assert.equal(malformedProfile.data.error, "Não foi possível concluir a solicitação", "erro interno não deve expor detalhes do PostgreSQL");


    const register = await request("/api/register", {
      method: "POST",
      body: { username: "security-test-user", password: "User-Test-123!", display_name: "Usuário de Teste" }
    });
    assert.equal(register.status, 200, "cadastro deve criar conta de teste");
    assert.ok(register.data.token, "cadastro deve emitir token");
    const userToken = register.data.token;
    const userId = register.data.user.id;

    // Cria um editor fictício e valida permissões positivas e negativas por papel.
    const editorRegister = await request("/api/register", {
      method: "POST",
      body: { username: "security-test-editor", password: "Editor-Test-123!", display_name: "Editor de Teste" }
    });
    assert.equal(editorRegister.status, 200, "cadastro de editor de teste deve funcionar");
    const editorId = editorRegister.data.user.id;
    const editorToken = editorRegister.data.token;
    await client.query("UPDATE users SET role = 'editor' WHERE id = $1", [editorId]);

    const postsFullAsEditor = await request("/api/posts?full=1", { token: editorToken });
    assert.equal(postsFullAsEditor.status, 200, "editor deve acessar conteúdo completo editorial");
    const eventsFullAsEditor = await request("/api/events?full=1", { token: editorToken });
    assert.equal(eventsFullAsEditor.status, 403, "editor não pode acessar lista administrativa completa de eventos");
    const pendingBandsAsUser = await request("/api/pending-bands", { token: userToken });
    assert.equal(pendingBandsAsUser.status, 403, "usuário comum não pode listar bandas pendentes");
    const rssWriteAsEditor = await request("/api/rss-feeds", {
      method: "POST", token: editorToken, body: { name: "Não deve criar", url: "https://example.com/feed" }
    });
    assert.equal(rssWriteAsEditor.status, 403, "editor não pode administrar feeds RSS");

    const editorPostTitle = "security-test-editor-post";
    await client.query("DELETE FROM posts WHERE title IN ($1, $2)", [editorPostTitle, editorPostTitle + "-updated"]);
    const editorPostCreate = await request("/api/posts", {
      method: "POST", token: editorToken,
      body: { title: editorPostTitle, content: "Conteúdo de teste isolado" }
    });
    assert.equal(editorPostCreate.status, 200, "editor deve poder criar notícia");
    const editorPostRow = await client.query("SELECT id FROM posts WHERE title = $1", [editorPostTitle]);
    assert.equal(editorPostRow.rowCount, 1, "notícia de teste deve ser gravada no PostgreSQL descartável");
    const editorPostId = editorPostRow.rows[0].id;
    const editorPostUpdate = await request("/api/posts/" + editorPostId, {
      method: "PUT", token: editorToken,
      body: { title: editorPostTitle + "-updated", content: "Conteúdo atualizado" }
    });
    assert.equal(editorPostUpdate.status, 200, "editor deve poder editar notícia");
    const editorPostDelete = await request("/api/posts/" + editorPostId, { method: "DELETE", token: editorToken });
    assert.equal(editorPostDelete.status, 200, "editor deve poder excluir notícia");
    const userPostWrite = await request("/api/posts", {
      method: "POST", token: userToken, body: { title: "Não permitido", content: "Teste" }
    });
    assert.equal(userPostWrite.status, 403, "usuário comum não pode criar notícia");
    const fullEventsAsAdmin = await request("/api/events?full=1", { token: adminToken });
    assert.equal(fullEventsAsAdmin.status, 200, "admin deve continuar acessando dados administrativos de eventos");

    // Smoke test das leituras que o painel Admin.jsx dispara ao abrir.
    const adminPanelReads = [
      ["/api/posts?full=1", "admin deve carregar notícias no painel"],
      ["/api/bands?full=1", "admin deve carregar bandas no painel"],
      ["/api/pending-bands", "admin deve carregar bandas pendentes no painel"],
      ["/api/interviews?full=1", "admin deve carregar entrevistas no painel"],
      ["/api/events?full=1", "admin deve carregar eventos no painel"],
      ["/api/releases?full=1", "admin deve carregar lançamentos no painel"],
      ["/api/rss-feeds", "admin deve carregar portais RSS no painel"],
      ["/api/rss-status", "admin deve carregar o status dos RSS no painel"],
      ["/api/users", "admin deve carregar usuários no painel"]
    ];
    for (const [path, message] of adminPanelReads) {
      const result = await request(path, { token: adminToken });
      assert.equal(result.status, 200, message + " (" + path + ")");
    }

    // Testes de CRUD do painel contra PostgreSQL descartável.
    const bandName = "Security Test Band";
    await client.query("DELETE FROM bands WHERE name = $1", [bandName]);
    const bandCreate = await request("/api/bands", { method: "POST", token: adminToken, body: { name: bandName, genre: "Rock", city: "São Paulo", state: "SP" } });
    assert.equal(bandCreate.status, 200, "admin deve criar banda");
    const bandRow = await client.query("SELECT id FROM bands WHERE name = $1", [bandName]);
    assert.equal(bandRow.rowCount, 1, "banda deve ser gravada");
    const bandId = bandRow.rows[0].id;
    const bandUpdate = await request("/api/bands/" + bandId, { method: "PUT", token: adminToken, body: { name: bandName + " Updated", genre: "Punk", city: "São Paulo", state: "SP" } });
    assert.equal(bandUpdate.status, 200, "admin deve editar banda");
    const featureBand = await request("/api/bands/" + bandId + "/weekly-featured", { method: "POST", token: adminToken, body: { featured: true } });
    assert.equal(featureBand.status, 200, "admin deve definir Banda da Semana");
    const bandDelete = await request("/api/bands/" + bandId, { method: "DELETE", token: adminToken });
    assert.equal(bandDelete.status, 200, "admin deve excluir banda");
    assert.equal((await client.query("SELECT id FROM bands WHERE id = $1", [bandId])).rowCount, 0, "banda excluída não deve permanecer no banco");

    const interviewTitle = "Security Test Interview";
    await client.query("DELETE FROM interviews WHERE title = $1", [interviewTitle]);
    const interviewCreate = await request("/api/interviews", { method: "POST", token: adminToken, body: { title: interviewTitle, artist: "Banda Teste", content: "Conteúdo teste" } });
    assert.equal(interviewCreate.status, 200, "admin deve criar entrevista");
    const interviewRow = await client.query("SELECT id FROM interviews WHERE title = $1", [interviewTitle]);
    assert.equal(interviewRow.rowCount, 1, "entrevista deve ser gravada");
    const interviewId = interviewRow.rows[0].id;
    assert.equal((await request("/api/interviews/" + interviewId, { method: "PUT", token: adminToken, body: { title: interviewTitle + " Updated", artist: "Banda Teste", content: "Atualizado" } })).status, 200, "admin deve editar entrevista");
    assert.equal((await request("/api/interviews/" + interviewId, { method: "DELETE", token: adminToken })).status, 200, "admin deve excluir entrevista");
    assert.equal((await client.query("SELECT id FROM interviews WHERE id = $1", [interviewId])).rowCount, 0, "entrevista excluída não deve permanecer no banco");

    const releaseTitle = "Security Test Release";
    await client.query("DELETE FROM releases WHERE title = $1", [releaseTitle]);
    assert.equal((await request("/api/releases", { method: "POST", token: adminToken, body: { title: releaseTitle, artist: "Banda Teste", type: "Single" } })).status, 200, "admin deve criar lançamento");
    const releaseRow = await client.query("SELECT id FROM releases WHERE title = $1", [releaseTitle]);
    assert.equal(releaseRow.rowCount, 1, "lançamento deve ser gravado");
    const releaseId = releaseRow.rows[0].id;
    assert.equal((await request("/api/releases/" + releaseId, { method: "PUT", token: adminToken, body: { title: releaseTitle + " Updated", artist: "Banda Teste", type: "EP" } })).status, 200, "admin deve editar lançamento");
    assert.equal((await request("/api/releases/" + releaseId, { method: "DELETE", token: adminToken })).status, 200, "admin deve excluir lançamento");
    assert.equal((await client.query("SELECT id FROM releases WHERE id = $1", [releaseId])).rowCount, 0, "lançamento excluído não deve permanecer no banco");

    // Exercita moderação de banda e exclusão administrativa de evento sem disparar e-mail real.
    const pendingBandName = "Security Test Pending Band";
    await client.query("DELETE FROM pending_bands WHERE name = $1", [pendingBandName]);
    const pendingBand = await client.query(
      "INSERT INTO pending_bands (name, genre, city, state) VALUES ($1, $2, $3, $4) RETURNING id",
      [pendingBandName, "Rock", "São Paulo", "SP"]
    );
    const approveBand = await request("/api/approve-band/" + pendingBand.rows[0].id, { method: "POST", token: adminToken });
    assert.equal(approveBand.status, 200, "admin deve aprovar banda pendente");
    assert.equal((await client.query("SELECT id FROM bands WHERE name = $1", [pendingBandName])).rowCount, 1, "aprovação deve criar banda publicada");
    assert.equal((await client.query("SELECT id FROM pending_bands WHERE id = $1", [pendingBand.rows[0].id])).rowCount, 0, "banda aprovada deve sair da fila pendente");

    const event = await client.query(
      "INSERT INTO events (title, artist, date, status) VALUES ($1, $2, $3, 'pending') RETURNING id",
      ["Security Test Event", "Banda Teste", "2099-01-01"]
    );
    const eventId = event.rows[0].id;
    assert.equal((await request("/api/events/" + eventId + "/status", { method: "PUT", token: adminToken, body: { status: "approved" } })).status, 200, "admin deve aprovar evento");
    assert.equal((await client.query("SELECT status FROM events WHERE id = $1", [eventId])).rows[0].status, "approved", "status do evento deve ser atualizado");
    assert.equal((await request("/api/events/" + eventId, { method: "DELETE", token: adminToken })).status, 200, "admin deve excluir evento");
    assert.equal((await client.query("SELECT id FROM events WHERE id = $1", [eventId])).rowCount, 0, "evento excluído não deve permanecer no banco");

    // Testa criar, editar e remover portal RSS no estado em memória e no banco descartável.
    const rssUrl = "https://security-test.example/feed.xml";
    await client.query("DELETE FROM rss_feeds WHERE url = $1", [rssUrl]);
    const rssCreate = await request("/api/rss-feeds", { method: "POST", token: adminToken, body: { name: "Security Test RSS", url: rssUrl } });
    assert.equal(rssCreate.status, 200, "admin deve criar portal RSS");
    const rssList = await request("/api/rss-feeds", { token: adminToken });
    const rssIndex = rssList.data.findIndex(feed => feed.url === rssUrl);
    assert.ok(rssIndex >= 0, "portal RSS recém-criado deve aparecer na lista");
    assert.equal((await request("/api/rss-feeds/" + rssIndex, { method: "PUT", token: adminToken, body: { name: "Security Test RSS Updated", url: rssUrl } })).status, 200, "admin deve editar portal RSS");
    const rssListUpdated = await request("/api/rss-feeds", { token: adminToken });
    const rssUpdatedIndex = rssListUpdated.data.findIndex(feed => feed.url === rssUrl);
    assert.ok(rssUpdatedIndex >= 0, "portal RSS editado deve continuar na lista");
    assert.equal((await request("/api/rss-feeds/" + rssUpdatedIndex, { method: "DELETE", token: adminToken })).status, 200, "admin deve excluir portal RSS");
    assert.equal((await client.query("SELECT id FROM rss_feeds WHERE url = $1", [rssUrl])).rowCount, 0, "portal RSS excluído não deve permanecer no banco");

    const usersAsUser = await request("/api/users", { token: userToken });
    assert.equal(usersAsUser.status, 403, "usuário comum não pode listar contas");
    const profileOther = await request("/api/user/" + adminId, { token: userToken });
    assert.equal(profileOther.status, 403, "usuário não pode ler perfil alheio");
    const profileSelf = await request("/api/user/" + userId, { token: userToken });
    assert.equal(profileSelf.status, 200, "usuário pode ler o próprio perfil");

    const roleEscalation = await request("/api/user/" + userId + "/role", {
      method: "PUT", token: userToken, body: { role: "admin" }
    });
    assert.equal(roleEscalation.status, 403, "usuário não pode promover a própria conta");
    const fullEvents = await request("/api/events?full=1", { token: userToken });
    assert.equal(fullEvents.status, 403, "usuário comum não pode ler eventos administrativos");
    assert.equal((await request("/api/events")).status, 200, "listagem pública de eventos deve continuar funcionando");

    const eventUnauth = await request("/api/events", {
      method: "POST", body: { title: "Evento não autorizado", date: "2099-01-01" }
    });
    assert.equal(eventUnauth.status, 401, "criação administrativa de evento deve exigir sessão");

    // Toda rota de escrita/admin deve bloquear chamadas anônimas antes de executar lógica ou SQL.
    const anonymousWriteChecks = [
      ["POST", "/api/posts", { title: "Não criar" }],
      ["PUT", "/api/posts/1", { title: "Não editar" }],
      ["DELETE", "/api/posts/1"],
      ["POST", "/api/bands", { name: "Não criar" }],
      ["PUT", "/api/bands/1", { name: "Não editar" }],
      ["DELETE", "/api/bands/1"],
      ["POST", "/api/interviews", { title: "Não criar", artist: "Teste" }],
      ["DELETE", "/api/interviews/1"],
      ["POST", "/api/releases", { title: "Não criar", artist: "Teste" }],
      ["DELETE", "/api/releases/1"],
      ["POST", "/api/rss-feeds", { name: "Não criar", url: "https://example.com/feed" }],
      ["POST", "/api/import-rss", { feeds: [] }],
      ["POST", "/api/reimport-rss", { feeds: [] }],
      ["POST", "/api/fix-html-entities", {}],
      ["POST", "/api/cleanup-duplicates", {}],
      ["PUT", "/api/events/1/status", { status: "approved" }],
      ["DELETE", "/api/events/1"]
    ];
    for (const [method, path, body] of anonymousWriteChecks) {
      const result = await request(path, { method, ...(body === undefined ? {} : { body }) });
      assert.equal(result.status, 401, method + " " + path + " deve rejeitar usuário anônimo");
    }
    // O formulário público de bandas continua acessível, mas tem limite próprio contra spam.
    let bandSubmissionRateLimited = false;
    for (let i = 0; i < 6; i++) {
      const attempt = await request("/api/bands/submit", { method: "POST", body: {} });
      if (attempt.status === 429) { bandSubmissionRateLimited = true; break; }
      assert.equal(attempt.status, 400, "inscrição inválida deve ser rejeitada sem criar banda");
    }
    assert.equal(bandSubmissionRateLimited, true, "inscrições públicas repetidas de banda devem ser limitadas");

    const uploadUnauth = await request("/api/upload-image", { method: "POST", body: { image: "data:image/png;base64,AA==" } });
    assert.equal(uploadUnauth.status, 401, "upload deve exigir sessão");

    const commentUnauth = await request("/api/comments", {
      method: "POST", body: { page_type: "posts", page_id: 1, content: "Sem sessão" }
    });
    assert.equal(commentUnauth.status, 401, "comentários devem exigir sessão");

    const comment = await request("/api/comments", {
      method: "POST", token: userToken,
      body: { page_type: "posts", page_id: 1, content: "Comentário autenticado", user_id: adminId, user_name: "Admin Falso", user_avatar: "https://invalid.example/avatar.png" }
    });
    assert.equal(comment.status, 200, "usuário autenticado deve poder comentar");
    assert.equal(Number(comment.data.comment.user_id), Number(userId), "autor deve vir da sessão, não do corpo");
    assert.equal(comment.data.comment.user_name, "Usuário de Teste", "nome do autor deve vir do perfil autenticado");

    const otherUser = await request("/api/register", {
      method: "POST",
      body: { username: "security-test-other", password: "Other-Test-123!", display_name: "Outro Usuário" }
    });
    assert.equal(otherUser.status, 200);
    const deleteOtherComment = await request("/api/comments/" + comment.data.comment.id, {
      method: "DELETE", token: otherUser.data.token
    });
    assert.equal(deleteOtherComment.status, 403, "usuário não pode excluir comentário alheio");
    const deleteOwnComment = await request("/api/comments/" + comment.data.comment.id, {
      method: "DELETE", token: userToken
    });
    assert.equal(deleteOwnComment.status, 200, "autor pode excluir o próprio comentário");

    const roleChange = await request("/api/user/" + otherUser.data.user.id + "/role", {
      method: "PUT", token: adminToken, body: { role: "editor" }
    });
    assert.equal(roleChange.status, 200, "admin deve alterar papel de usuário");
    assert.equal(roleChange.data.user.role, "editor", "papel atualizado deve ser refletido na resposta");
    const roleRestore = await request("/api/user/" + otherUser.data.user.id + "/role", {
      method: "PUT", token: adminToken, body: { role: "user" }
    });
    assert.equal(roleRestore.status, 200, "admin deve poder restaurar papel de usuário");
    assert.equal((await request("/api/user/" + otherUser.data.user.id, { method: "DELETE", token: adminToken })).status, 200, "admin deve excluir usuário comum");
    assert.equal((await client.query("SELECT id FROM users WHERE id = $1", [otherUser.data.user.id])).rowCount, 0, "usuário excluído não deve permanecer no banco");

    const adminUsers = await request("/api/users", { token: adminToken });
    assert.equal(adminUsers.status, 200, "admin deve continuar acessando a gestão de usuários");
    const logout = await request("/api/logout", { method: "POST", token: userToken });
    assert.equal(logout.status, 200, "logout deve revogar sessão");
    const sessionAfterLogout = await request("/api/session", { token: userToken });
    assert.equal(sessionAfterLogout.status, 401, "token revogado não pode reutilizar a sessão");

    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      const attempt = await request("/api/login", { method: "POST", body: { user: "no-such-user", pass: "invalid-password" } });
      if (attempt.status === 429) { rateLimited = true; break; }
    }
    assert.equal(rateLimited, true, "tentativas repetidas de login devem ser limitadas");

    console.log("PASS: autenticação, migração de senha, autorização por papel, bloqueio de rotas de escrita anônimas, perfis, comentários, upload, logout e rate limit.");
  } catch (error) {
    console.error("FAIL: teste de segurança", error);
    process.exitCode = 1;
  } finally {
    if (client) await client.end().catch(() => {});
    server.kill("SIGTERM");
    await new Promise(resolve => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }
})();
