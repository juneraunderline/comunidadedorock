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
    await client.query("DELETE FROM users WHERE username IN ($1, $2, $3)", [adminName, "security-test-user", "security-test-other"]);
    const inserted = await client.query(
      "INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
      [adminName, adminPass, "Admin de Teste"]
    );
    const adminId = inserted.rows[0].id;

    const unauthUsers = await request("/api/users");
    assert.equal(unauthUsers.status, 401, "lista de usuários deve exigir autenticação");

    const adminLogin = await request("/api/login", { method: "POST", body: { user: adminName, pass: adminPass } });
    assert.equal(adminLogin.status, 200, "admin legado deve conseguir entrar com a senha atual");
    assert.ok(adminLogin.data.token, "login deve emitir token");
    const migrated = await client.query("SELECT password FROM users WHERE id = $1", [adminId]);
    assert.match(migrated.rows[0].password, /^scrypt\$/, "senha legada deve migrar para scrypt após login válido");
    const adminToken = adminLogin.data.token;

    const register = await request("/api/register", {
      method: "POST",
      body: { username: "security-test-user", password: "User-Test-123!", display_name: "Usuário de Teste" }
    });
    assert.equal(register.status, 200, "cadastro deve criar conta de teste");
    assert.ok(register.data.token, "cadastro deve emitir token");
    const userToken = register.data.token;
    const userId = register.data.user.id;

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

    const adminUsers = await request("/api/users", { token: adminToken });
    assert.equal(adminUsers.status, 200, "admin deve continuar acessando a gestão de usuários");
    const logout = await request("/api/logout", { method: "POST", token: userToken });
    assert.equal(logout.status, 200, "logout deve revogar sessão");
    const sessionAfterLogout = await request("/api/session", { token: userToken });
    assert.equal(sessionAfterLogout.status, 401, "token revogado não pode reutilizar a sessão");

    console.log("PASS: autenticação, migração de senha, autorização por papel, perfis, comentários, upload e logout.");
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
