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
  for (const feed of rssFeeds) {
    try {
      const res = await fetchFunc(feed.url);
      const xml = await res.text();
      const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
      
      for (const itemXml of items.slice(0, 5)) {
        const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
        const content = extractContentFromItem(itemXml);
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
setInterval(autoImportRss, 60000);

// --- ROTAS DA API ---

app.post("/api/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === "admin" && pass === "1234") return res.json({ success: true });
  res.status(401).json({ success: false });
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
        for (const itemXml of items.slice(0, 10)) {
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
    for (const itemXml of items.slice(0, 10)) {
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
        for (const itemXml of items.slice(0, 10)) {
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

// Inicializar banco e iniciar servidor
async function startServer() {
  await initDb();
  await loadFeeds();
  autoImportRss();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server ON: http://localhost:${PORT}`));
}
startServer().catch(err => {
  console.error("❌ Erro ao iniciar servidor:", err);
  process.exit(1);
});
