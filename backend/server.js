const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

let fetchFunc;
if (typeof fetch !== "undefined") {
  fetchFunc = fetch;
} else {
  try {
    fetchFunc = require("node-fetch");
  } catch (err) {
    throw new Error("fetch is not available. Instale node-fetch ou use Node >= 18.");
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// BANCO POSTGRESQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Helper para queries
const db = {
  query: async (text, params) => {
    const res = await pool.query(text, params);
    return res;
  },
  getAll: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  },
  getOne: async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  },
  run: async (text, params) => {
    await pool.query(text, params);
  }
};

// Inicialização de Tabelas
const initDb = async () => {
  await db.run(`CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title TEXT, content TEXT, image TEXT, link TEXT, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS pending_bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS rss_feeds (id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, logo TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT, artist TEXT, date TEXT, time TEXT, location TEXT, city TEXT, state TEXT, image TEXT, ticket_link TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS interviews (id SERIAL PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, content TEXT, image TEXT, date TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, display_name TEXT, avatar TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`);
};

// Carregar Feeds
let rssFeeds = [];
async function loadFeeds() {
  try {
    const rows = await db.getAll("SELECT * FROM rss_feeds");
    if (rows.length > 0) {
      rssFeeds = rows;
    } else {
      const defaults = [
        { name: "Rolling Stone Brasil", url: "https://rollingstone.com.br/feed/", logo: null },
        { name: "Rock in Rio News", url: "https://www.rockinrio.com/pt-br/feed/", logo: null }
      ];
      for (const f of defaults) {
        await db.run("INSERT INTO rss_feeds (name, url, logo) VALUES ($1, $2, $3) ON CONFLICT (url) DO NOTHING", [f.name, f.url, f.logo]);
      }
      rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
    }
  } catch (e) { console.error(e); }
}

// --- FUNÇÕES AUXILIARES ---

function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#8216;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&#8218;/g, ",").replace(/&#8219;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8222;/g, '"').replace(/&#8223;/g, '"')
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "…").replace(/&#8226;/g, "•")
    .replace(/&#8364;/g, "€").replace(/&#163;/g, "£")
    .replace(/&#xe9;/gi, "é").replace(/&#xe3;/gi, "ã")
    .replace(/&#xe7;/gi, "ç").replace(/&#xf3;/gi, "ó")
    .replace(/&#xfa;/gi, "ú").replace(/&#xed;/gi, "í")
    .replace(/&#xf4;/gi, "ô").replace(/&#xe1;/gi, "á")
    .replace(/&#xea;/gi, "ê").replace(/&#xe0;/gi, "à")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function sanitizeImageUrl(url) {
  if (!url || !url.startsWith("http") || url.includes("youtube.com/embed")) return "";
  return url.replace(/\/(www\.[^\s\/]+\.com)\//i, "/").replace(/\/uploads\.([^\/]+\.com)\//i, "/uploads/").trim();
}

function extractContentFromItem(item) {
  let content = item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] || 
                item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
  content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
  return content.length > 10 ? content : null;
}

function extractImageFromItem(item, content) {
  let image = item.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1] || 
              item.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
              content?.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1];
  return sanitizeImageUrl(image) || null;
}

function extractLinkFromItem(item) {
  return item.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1]?.trim() || item.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || "";
}

function extractDateFromItem(item) {
  const dateStr = item.match(/<(pubDate|published|updated)[^>]*>([^<]+)</i)?.[2];
  const date = dateStr ? new Date(dateStr) : new Date();
  return isNaN(date) ? new Date().toISOString() : date.toISOString();
}

// --- LOGICA RSS AUTOMÁTICA ---

async function autoImportRss() {
  // Recarregar feeds do banco para pegar novos feeds adicionados
  try {
    rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
  } catch (e) { console.warn("Erro ao recarregar feeds:", e.message); }
  for (const feed of rssFeeds) {
    try {
      const res = await fetchFunc(feed.url);
      const xml = await res.text();
      const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
      
      for (const itemXml of items) {
        const rawTitle = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
        const title = decodeHtmlEntities(rawTitle);
        const content = decodeHtmlEntities(extractContentFromItem(itemXml));
        const image = extractImageFromItem(itemXml, content);
        const link = extractLinkFromItem(itemXml);

        if (!title || !image) continue;

        const exists = await db.getOne("SELECT id FROM posts WHERE title = $1", [title]);
        if (!exists) {
          await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)",
            [title, content, image, link, feed.name]);
          console.log(`✅ Importado: ${title.substring(0, 30)}`);
        }
      }
    } catch (e) { console.warn(`Erro no feed ${feed.name}: ${e.message}`); }
  }
}
setInterval(autoImportRss, 5000);

// --- ROTAS DA API ---

// Autenticação
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    if (username.length < 3) return res.status(400).json({ error: "Usuário deve ter pelo menos 3 caracteres" });
    if (password.length < 4) return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
    const exists = await db.getOne("SELECT id FROM users WHERE username = $1", [username.toLowerCase()]);
    if (exists) return res.status(409).json({ error: "Usuário já existe" });
    const userRole = role === "editor" ? "editor" : "user";
    const result = await pool.query(
      "INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, avatar, role, created_at",
      [username.toLowerCase(), password, display_name || username, userRole]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { user, pass } = req.body;
    // Garantir que admin existe no banco (apenas 1)
    const admins = await db.getAll("SELECT * FROM users WHERE username = 'admin' ORDER BY id ASC");
    if (admins.length === 0) {
      await pool.query(
        "INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, $4)",
        ["admin", "1234", "Administrador", "admin"]
      );
    } else if (admins.length > 1) {
      // Remover duplicados, manter só o primeiro
      for (let i = 1; i < admins.length; i++) {
        await db.run("DELETE FROM users WHERE id = $1", [admins[i].id]);
      }
    }
    // Login — sempre verifica senha do banco
    const found = await db.getOne("SELECT * FROM users WHERE username = $1 AND password = $2", [user?.toLowerCase(), pass]);
    if (!found) return res.status(401).json({ success: false, error: "Usuário ou senha incorretos" });
    res.json({ success: true, user: { id: found.id, username: found.username, display_name: found.display_name, avatar: found.avatar, role: found.role, created_at: found.created_at } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/user/:id", async (req, res) => {
  try {
    const user = await db.getOne("SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/user/:id", async (req, res) => {
  try {
    const { display_name, username, avatar, new_password, current_password } = req.body;
    const user = await db.getOne("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (new_password) {
      if (!current_password || current_password !== user.password) {
        return res.status(403).json({ error: "Senha atual incorreta" });
      }
      if (new_password.length < 4) return res.status(400).json({ error: "Nova senha deve ter pelo menos 4 caracteres" });
      await db.run("UPDATE users SET password = $1 WHERE id = $2", [new_password, req.params.id]);
    }
    if (username !== undefined && username !== user.username) {
      if (username.length < 3) return res.status(400).json({ error: "Usuário deve ter pelo menos 3 caracteres" });
      const exists = await db.getOne("SELECT id FROM users WHERE username = $1 AND id != $2", [username.toLowerCase(), req.params.id]);
      if (exists) return res.status(409).json({ error: "Este nome de usuário já está em uso" });
      await db.run("UPDATE users SET username = $1 WHERE id = $2", [username.toLowerCase(), req.params.id]);
    }
    if (display_name !== undefined) {
      await db.run("UPDATE users SET display_name = $1 WHERE id = $2", [display_name, req.params.id]);
    }
    if (avatar !== undefined) {
      await db.run("UPDATE users SET avatar = $1 WHERE id = $2", [avatar, req.params.id]);
    }
    const updated = await db.getOne("SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gerenciamento de usuários (admin)
app.get("/api/users", async (req, res) => {
  try {
    res.json(await db.getAll("SELECT id, username, display_name, avatar, role, created_at FROM users ORDER BY created_at DESC"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/user/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "editor", "user"].includes(role)) return res.status(400).json({ error: "Role inválida" });
    await db.run("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);
    const updated = await db.getOne("SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/user/:id", async (req, res) => {
  try {
    const user = await db.getOne("SELECT role FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (user.role === "admin") return res.status(403).json({ error: "Não é possível deletar um admin" });
    await db.run("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Posts
app.get("/api/posts", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM posts ORDER BY id DESC"));
});

app.post("/api/posts", async (req, res) => {
  const { title, content, image, link } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  await db.run("INSERT INTO posts (title, content, image, link) VALUES ($1, $2, $3, $4)", [title, content, image || null, link || null]);
  res.json({ success: true });
});

app.put("/api/posts/:id", async (req, res) => {
  const { title, content, image, link } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  await db.run("UPDATE posts SET title = $1, content = $2, image = $3, link = $4 WHERE id = $5", [title, content, image || null, link || null, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/posts/:id", async (req, res) => {
  await db.run("DELETE FROM posts WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// Bandas
app.get("/api/bands", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM bands ORDER BY name ASC"));
});

app.post("/api/bands", async (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  await db.run(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site]);
  res.json({ success: true });
});

app.put("/api/bands/:id", async (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  await db.run(`UPDATE bands SET name=$1, genre=$2, city=$3, state=$4, year=$5, members=$6, biography=$7, contact=$8, image=$9, instagram=$10, facebook=$11, youtube=$12, spotify=$13, bandcamp=$14, site=$15 WHERE id=$16`,
    [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/bands/:id", async (req, res) => {
  await db.run("DELETE FROM bands WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

app.post("/api/bands/submit", async (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  await db.run(`INSERT INTO pending_bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site]);
  res.json({ success: true, message: "Banda cadastrada com sucesso! Aguarde a aprovação." });
});

app.get("/api/pending-bands", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM pending_bands"));
});

app.post("/api/approve-band/:id", async (req, res) => {
  const band = await db.getOne("SELECT * FROM pending_bands WHERE id = $1", [req.params.id]);
  if (!band) return res.status(404).send();
  await db.run(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [band.name, band.genre, band.city, band.state, band.year, band.members, band.biography, band.contact, band.image, band.instagram, band.facebook, band.youtube, band.spotify, band.bandcamp, band.site]);
  await db.run("DELETE FROM pending_bands WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

app.delete("/api/pending-bands/:id", async (req, res) => {
  try {
    await db.run("DELETE FROM pending_bands WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Entrevistas
app.get("/api/interviews", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM interviews ORDER BY id DESC"));
});

app.post("/api/interviews", async (req, res) => {
  const { title, artist, content, image, date } = req.body;
  if (!title || !artist) return res.status(400).json({ error: "Título e artista são obrigatórios" });
  await db.run("INSERT INTO interviews (title, artist, content, image, date) VALUES ($1, $2, $3, $4, $5)", [title, artist, content || null, image || null, date || null]);
  res.json({ success: true });
});

app.put("/api/interviews/:id", async (req, res) => {
  const { title, artist, content, image, date } = req.body;
  if (!title || !artist) return res.status(400).json({ error: "Título e artista são obrigatórios" });
  await db.run("UPDATE interviews SET title=$1, artist=$2, content=$3, image=$4, date=$5 WHERE id=$6", [title, artist, content || null, image || null, date || null, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/interviews/:id", async (req, res) => {
  await db.run("DELETE FROM interviews WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// Eventos
app.get("/api/events", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM events ORDER BY date ASC"));
});

app.post("/api/events", async (req, res) => {
  const e = req.body;
  if (!e.title || !e.date) return res.status(400).json({ error: "Título e data são obrigatórios" });
  await db.run("INSERT INTO events (title, artist, date, time, location, city, state, image, ticket_link, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [e.title, e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.description]);
  res.json({ success: true });
});

app.put("/api/events/:id", async (req, res) => {
  const e = req.body;
  if (!e.title || !e.date) return res.status(400).json({ error: "Título e data são obrigatórios" });
  await db.run("UPDATE events SET title=$1, artist=$2, date=$3, time=$4, location=$5, city=$6, state=$7, image=$8, ticket_link=$9, description=$10 WHERE id=$11",
    [e.title, e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.description, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/events/:id", async (req, res) => {
  await db.run("DELETE FROM events WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// Feeds RSS
app.get("/api/rss-feeds", (req, res) => res.json(rssFeeds));

app.post("/api/rss-feeds", async (req, res) => {
  const { name, url, logo } = req.body;
  if (!name || !url) return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  await db.run("INSERT INTO rss_feeds (name, url, logo) VALUES ($1, $2, $3)", [name, url, logo || null]);
  rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
  res.json({ success: true, feeds: rssFeeds });
});

app.put("/api/rss-feeds/:index", async (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  await db.run("UPDATE rss_feeds SET name = $1, url = $2 WHERE id = $3", [name, url, feed.id]);
  rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
  res.json({ success: true, feeds: rssFeeds });
});

app.put("/api/rss-feeds/:index/logo", async (req, res) => {
  const { logo } = req.body;
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  await db.run("UPDATE rss_feeds SET logo = $1 WHERE id = $2", [logo || null, feed.id]);
  rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
  res.json({ success: true, feeds: rssFeeds });
});

app.delete("/api/rss-feeds/:index", async (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  await db.run("DELETE FROM rss_feeds WHERE id = $1", [feed.id]);
  rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
  res.json({ success: true, feeds: rssFeeds });
});

// Import RSS
app.post("/api/import-rss", async (req, res) => {
  try {
    let imported = 0;
    const feeds = req.body.feeds || rssFeeds;
    for (const feed of feeds) {
      try {
        const response = await fetchFunc(feed.url);
        const xml = await response.text();
        const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
        for (const itemXml of items) {
          const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
          const content = extractContentFromItem(itemXml);
          const image = extractImageFromItem(itemXml, content);
          const link = extractLinkFromItem(itemXml);
          if (!title) continue;
          const exists = await db.getOne("SELECT id FROM posts WHERE title = $1", [title]);
          if (!exists) {
            await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)", [title, content, image, link, feed.name]);
            imported++;
          }
        }
      } catch (e) { console.warn(`Erro no feed ${feed.name}: ${e.message}`); }
    }
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/import-rss-single", async (req, res) => {
  try {
    const { feed } = req.body;
    if (!feed || !feed.url) return res.status(400).json({ error: "Feed inválido" });
    let imported = 0;
    const response = await fetchFunc(feed.url);
    const xml = await response.text();
    const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
    for (const itemXml of items) {
      const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      const content = extractContentFromItem(itemXml);
      const image = extractImageFromItem(itemXml, content);
      const link = extractLinkFromItem(itemXml);
      if (!title) continue;
      const exists = await db.getOne("SELECT id FROM posts WHERE title = $1", [title]);
      if (!exists) {
        await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)", [title, content, image, link, feed.name]);
        imported++;
      }
    }
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reimport-rss", async (req, res) => {
  try {
    let updated = 0;
    let created = 0;
    const feeds = req.body.feeds || rssFeeds;
    for (const feed of feeds) {
      try {
        const response = await fetchFunc(feed.url);
        const xml = await response.text();
        const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
        for (const itemXml of items) {
          const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
          const content = extractContentFromItem(itemXml);
          const image = extractImageFromItem(itemXml, content);
          const link = extractLinkFromItem(itemXml);
          if (!title) continue;
          const existing = await db.getOne("SELECT id, image FROM posts WHERE title = $1", [title]);
          if (existing) {
            if (image && !existing.image) {
              await db.run("UPDATE posts SET image = $1 WHERE id = $2", [image, existing.id]);
              updated++;
            }
          } else {
            await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)", [title, content, image, link, feed.name]);
            created++;
          }
        }
      } catch (e) { console.warn(`Erro no feed ${feed.name}: ${e.message}`); }
    }
    res.json({ success: true, updated, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/fix-missing-images", async (req, res) => {
  try {
    const postsWithoutImages = await db.getAll("SELECT * FROM posts WHERE image IS NULL OR image = ''");
    let fixed = 0;
    for (const post of postsWithoutImages) {
      const imgMatch = (post.content || "").match(/<img[^>]*src=["']([^"']+)["']/i);
      if (imgMatch) {
        await db.run("UPDATE posts SET image = $1 WHERE id = $2", [imgMatch[1], post.id]);
        fixed++;
      }
    }
    res.json({ success: true, fixed, total: postsWithoutImages.length, message: `${fixed} imagens corrigidas de ${postsWithoutImages.length} posts sem imagem` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/test-rss-images", async (req, res) => {
  try {
    const { feedUrl } = req.body;
    if (!feedUrl) return res.status(400).json({ error: "URL do feed é obrigatória" });
    const response = await fetchFunc(feedUrl);
    const xml = await response.text();
    const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
    let itemsWithImages = 0;
    let itemsWithoutImages = 0;
    for (const itemXml of items) {
      const content = extractContentFromItem(itemXml);
      const image = extractImageFromItem(itemXml, content);
      if (image) itemsWithImages++;
      else itemsWithoutImages++;
    }
    res.json({ success: true, feedUrl, totalItems: items.length, itemsWithImages, itemsWithoutImages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// --- OPEN GRAPH HELPERS ---
function buildOgHtml(title, description, image, ogUrl, type) {
  const safeImg = (image || "").replace('http://', 'https://');
  return `<!DOCTYPE html>
<html prefix="og: http://ogp.me/ns#">
<head>
<meta charset="utf-8" />
<title>${title} - Comunidade do Rock</title>
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${safeImg}" />
<meta property="og:image:url" content="${safeImg}" />
<meta property="og:image:secure_url" content="${safeImg}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:url" content="${ogUrl}" />
<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="Comunidade do Rock" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${safeImg}" />
<link rel="canonical" href="${ogUrl}" />
</head>
<body><h1>${title}</h1><p>${description}</p><img src="${safeImg}" alt="${title}" width="1200" height="630" /></body>
</html>`;
}
function resolveImage(img) {
  if (!img) return "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=1200&h=630&fit=crop";
  if (img.startsWith("http")) return img;
  return "https://comunidadedorock.onrender.com" + img;
}
function isCrawler(ua) {
  const l = (ua || "").toLowerCase();
  return l.includes("facebookexternalhit") || l.includes("twitterbot") || l.includes("whatsapp") || l.includes("telegrambot") || l.includes("linkedinbot") || l.includes("slackbot") || l.includes("bot") || l.includes("crawl") || l.includes("spider");
}
function sendOg(res, title, description, image, ogUrl, type, siteUrl, ua) {
  if (!isCrawler(ua)) return res.redirect(siteUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(buildOgHtml(title, description, image, ogUrl, type));
}

// OG - Notícias
app.get("/og/noticias/:id", async (req, res) => {
  try {
    const post = await db.getOne("SELECT * FROM posts WHERE id = $1", [req.params.id]);
    if (!post) return res.redirect("https://comunidadedorock.com.br/noticias");
    const title = (post.title || "Comunidade do Rock").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const description = ((post.content || "").replace(/<[^>]+>/g, "").substring(0, 200) + "...").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    sendOg(res, title, description, resolveImage(post.image), `https://comunidadedorock.com.br/og/noticias/${post.id}`, "article", `https://comunidadedorock.com.br/noticias/${post.id}`, req.headers["user-agent"]);
  } catch (err) { res.redirect("https://comunidadedorock.com.br"); }
});

// OG - Bandas
app.get("/og/bandas/:id", async (req, res) => {
  try {
    const band = await db.getOne("SELECT * FROM bands WHERE id = $1", [req.params.id]);
    if (!band) return res.redirect("https://comunidadedorock.com.br/bandas");
    const title = (band.name || "Banda").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const description = ((band.biography || band.genre || "Conheça essa banda no Comunidade do Rock").substring(0, 200)).replace(/"/g, "&quot;").replace(/</g, "&lt;");
    sendOg(res, title, description, resolveImage(band.image), `https://comunidadedorock.com.br/og/bandas/${band.id}`, "profile", `https://comunidadedorock.com.br/bandas/${band.id}`, req.headers["user-agent"]);
  } catch (err) { res.redirect("https://comunidadedorock.com.br"); }
});

// OG - Entrevistas
app.get("/og/entrevistas/:id", async (req, res) => {
  try {
    const item = await db.getOne("SELECT * FROM interviews WHERE id = $1", [req.params.id]);
    if (!item) return res.redirect("https://comunidadedorock.com.br/entrevistas");
    const title = (`${item.title} - ${item.artist}`).replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const description = ((item.content || "Entrevista exclusiva no Comunidade do Rock").replace(/<[^>]+>/g, "").substring(0, 200)).replace(/"/g, "&quot;").replace(/</g, "&lt;");
    sendOg(res, title, description, resolveImage(item.image), `https://comunidadedorock.com.br/og/entrevistas/${item.id}`, "article", `https://comunidadedorock.com.br/entrevistas/${item.id}`, req.headers["user-agent"]);
  } catch (err) { res.redirect("https://comunidadedorock.com.br"); }
});

// OG - Eventos
app.get("/og/eventos/:id", async (req, res) => {
  try {
    const item = await db.getOne("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (!item) return res.redirect("https://comunidadedorock.com.br/eventos");
    const title = (item.title || "Evento").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const dateBR = item.date ? item.date.split("-").reverse().join("/") : "";
    const desc = [item.artist, dateBR, item.location, item.city].filter(Boolean).join(" · ");
    const description = (desc || "Confira este evento no Comunidade do Rock").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    sendOg(res, title, description, resolveImage(item.image), `https://comunidadedorock.com.br/og/eventos/${item.id}`, "event", `https://comunidadedorock.com.br/eventos/${item.id}`, req.headers["user-agent"]);
  } catch (err) { res.redirect("https://comunidadedorock.com.br"); }
});

// Inicializar banco e iniciar servidor
async function startServer() {
  await initDb();
  await loadFeeds();
  // Limpar entidades HTML dos títulos e conteúdos existentes
  try {
    const allPosts = await db.getAll("SELECT id, title, content FROM posts");
    for (const p of allPosts) {
      const cleanTitle = decodeHtmlEntities(p.title);
      const cleanContent = decodeHtmlEntities(p.content);
      if (cleanTitle !== p.title || cleanContent !== p.content) {
        await db.run("UPDATE posts SET title = $1, content = $2 WHERE id = $3", [cleanTitle, cleanContent, p.id]);
      }
    }
    console.log("✅ Entidades HTML limpas dos posts existentes");
  } catch (e) { console.warn("Erro ao limpar entidades:", e.message); }
  // Resetar senha admin para 1234 (rodar uma vez)
  await db.run("UPDATE users SET password = '1234' WHERE username = 'admin'").catch(() => {});
  // Remover admins duplicados
  const admins = await db.getAll("SELECT id FROM users WHERE username = 'admin' ORDER BY id ASC").catch(() => []);
  if (admins.length > 1) {
    for (let i = 1; i < admins.length; i++) {
      await db.run("DELETE FROM users WHERE id = $1", [admins[i].id]).catch(() => {});
    }
  }
  autoImportRss();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server ON: http://localhost:${PORT}`));
}
startServer().catch(err => {
  console.error("❌ Erro ao iniciar servidor:", err);
  process.exit(1);
});
