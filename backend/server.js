const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const { downloadImage, imagesDir } = require("./image-downloader");

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

// Servir imagens locais
app.use('/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Cache-Control', 'public, max-age=31536000');
  next();
}, express.static(imagesDir));

// BANCO SQLITE
const db = new Database("./database.db");

// Inicialização de Tabelas
const initDb = () => {
  db.prepare(`CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, image TEXT, link TEXT, source TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS bands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS pending_bands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT, submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS rss_feeds (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, logo TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, artist TEXT, date TEXT, time TEXT, location TEXT, city TEXT, state TEXT, image TEXT, ticket_link TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS interviews (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist TEXT NOT NULL, content TEXT, image TEXT, date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
};
initDb();

// Carregar Feeds
let rssFeeds = [];
try {
  const rows = db.prepare("SELECT * FROM rss_feeds").all();
  if (rows.length > 0) {
    rssFeeds = rows;
  } else {
    rssFeeds = [
      { name: "Rolling Stone Brasil", url: "https://rollingstone.com.br/feed/", logo: null },
      { name: "Rock in Rio News", url: "https://www.rockinrio.com/pt-br/feed/", logo: null }
    ];
    rssFeeds.forEach(f => db.prepare("INSERT INTO rss_feeds (name, url, logo) VALUES (?, ?, ?)").run(f.name, f.url, f.logo));
  }
} catch (e) { console.error(e); }

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

        const exists = db.prepare("SELECT id FROM posts WHERE title = ?").get(title);
        if (!exists) {
          const localImg = await downloadImage(image).catch(() => image);
          db.prepare("INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)")
            .run(title, content, localImg || image, link, feed.name);
          console.log(`✅ Importado: ${title.substring(0, 30)}`);
        }
      }
    } catch (e) { console.warn(`Erro no feed ${feed.name}: ${e.message}`); }
  }
}
setInterval(autoImportRss, 60000); // 1 minuto é mais saudável que 5s

// --- ROTAS DA API ---

app.post("/api/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === "admin" && pass === "1234") return res.json({ success: true });
  res.status(401).json({ success: false });
});

// Posts
app.get("/api/posts", (req, res) => {
  const rows = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/posts", (req, res) => {
  const { title, content, image, link } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  db.prepare("INSERT INTO posts (title, content, image, link) VALUES (?, ?, ?, ?)").run(title, content, image || null, link || null);
  res.json({ success: true });
});

app.put("/api/posts/:id", (req, res) => {
  const { title, content, image, link } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  db.prepare("UPDATE posts SET title = ?, content = ?, image = ?, link = ? WHERE id = ?").run(title, content, image || null, link || null, req.params.id);
  res.json({ success: true });
});

app.delete("/api/posts/:id", (req, res) => {
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Bandas
app.get("/api/bands", (req, res) => {
  res.json(db.prepare("SELECT * FROM bands ORDER BY name ASC").all());
});

app.post("/api/bands", (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  db.prepare(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site);
  res.json({ success: true });
});

app.put("/api/bands/:id", (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  db.prepare(`UPDATE bands SET name = ?, genre = ?, city = ?, state = ?, year = ?, members = ?, biography = ?, contact = ?, image = ?, instagram = ?, facebook = ?, youtube = ?, spotify = ?, bandcamp = ?, site = ? WHERE id = ?`)
    .run(b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site, req.params.id);
  res.json({ success: true });
});

app.delete("/api/bands/:id", (req, res) => {
  db.prepare("DELETE FROM bands WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/bands/submit", (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
  db.prepare(`INSERT INTO pending_bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site);
  res.json({ success: true, message: "Banda cadastrada com sucesso! Aguarde a aprovação." });
});

app.get("/api/pending-bands", (req, res) => {
  res.json(db.prepare("SELECT * FROM pending_bands").all());
});

app.post("/api/approve-band/:id", (req, res) => {
  const band = db.prepare("SELECT * FROM pending_bands WHERE id = ?").get(req.params.id);
  if (!band) return res.status(404).send();
  
  const stmt = db.prepare(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(band.name, band.genre, band.city, band.state, band.year, band.members, band.biography, band.contact, band.image, band.instagram, band.facebook, band.youtube, band.spotify, band.bandcamp, band.site);
  db.prepare("DELETE FROM pending_bands WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Entrevistas
app.get("/api/interviews", (req, res) => {
  res.json(db.prepare("SELECT * FROM interviews ORDER BY id DESC").all());
});

app.post("/api/interviews", (req, res) => {
  const { title, artist, content, image, date } = req.body;
  if (!title || !artist) return res.status(400).json({ error: "Título e artista são obrigatórios" });
  db.prepare("INSERT INTO interviews (title, artist, content, image, date) VALUES (?, ?, ?, ?, ?)").run(title, artist, content || null, image || null, date || null);
  res.json({ success: true });
});

app.put("/api/interviews/:id", (req, res) => {
  const { title, artist, content, image, date } = req.body;
  if (!title || !artist) return res.status(400).json({ error: "Título e artista são obrigatórios" });
  db.prepare("UPDATE interviews SET title = ?, artist = ?, content = ?, image = ?, date = ? WHERE id = ?").run(title, artist, content || null, image || null, date || null, req.params.id);
  res.json({ success: true });
});

app.delete("/api/interviews/:id", (req, res) => {
  db.prepare("DELETE FROM interviews WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Eventos
app.get("/api/events", (req, res) => {
  res.json(db.prepare("SELECT * FROM events ORDER BY date ASC").all());
});

app.post("/api/events", (req, res) => {
  const e = req.body;
  if (!e.title || !e.date) return res.status(400).json({ error: "Título e data são obrigatórios" });
  db.prepare("INSERT INTO events (title, artist, date, time, location, city, state, image, ticket_link, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(e.title, e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.description);
  res.json({ success: true });
});

app.put("/api/events/:id", (req, res) => {
  const e = req.body;
  if (!e.title || !e.date) return res.status(400).json({ error: "Título e data são obrigatórios" });
  db.prepare("UPDATE events SET title = ?, artist = ?, date = ?, time = ?, location = ?, city = ?, state = ?, image = ?, ticket_link = ?, description = ? WHERE id = ?")
    .run(e.title, e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.description, req.params.id);
  res.json({ success: true });
});

app.delete("/api/events/:id", (req, res) => {
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Feeds RSS
app.get("/api/rss-feeds", (req, res) => res.json(rssFeeds));

app.post("/api/rss-feeds", (req, res) => {
  const { name, url, logo } = req.body;
  if (!name || !url) return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  db.prepare("INSERT INTO rss_feeds (name, url, logo) VALUES (?, ?, ?)").run(name, url, logo || null);
  rssFeeds = db.prepare("SELECT * FROM rss_feeds").all();
  res.json({ success: true, feeds: rssFeeds });
});

app.put("/api/rss-feeds/:index", (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  db.prepare("UPDATE rss_feeds SET name = ?, url = ? WHERE id = ?").run(name, url, feed.id);
  rssFeeds = db.prepare("SELECT * FROM rss_feeds").all();
  res.json({ success: true, feeds: rssFeeds });
});

app.put("/api/rss-feeds/:index/logo", (req, res) => {
  const { logo } = req.body;
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  db.prepare("UPDATE rss_feeds SET logo = ? WHERE id = ?").run(logo || null, feed.id);
  rssFeeds = db.prepare("SELECT * FROM rss_feeds").all();
  res.json({ success: true, feeds: rssFeeds });
});

app.delete("/api/rss-feeds/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= rssFeeds.length) return res.status(404).json({ error: "Feed não encontrado" });
  const feed = rssFeeds[index];
  db.prepare("DELETE FROM rss_feeds WHERE id = ?").run(feed.id);
  rssFeeds = db.prepare("SELECT * FROM rss_feeds").all();
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
          const exists = db.prepare("SELECT id FROM posts WHERE title = ?").get(title);
          if (!exists) {
            const localImg = image ? await downloadImage(image).catch(() => image) : null;
            db.prepare("INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)").run(title, content, localImg || image, link, feed.name);
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
      const exists = db.prepare("SELECT id FROM posts WHERE title = ?").get(title);
      if (!exists) {
        const localImg = image ? await downloadImage(image).catch(() => image) : null;
        db.prepare("INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)").run(title, content, localImg || image, link, feed.name);
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
          const existing = db.prepare("SELECT id, image FROM posts WHERE title = ?").get(title);
          if (existing) {
            if (image && !existing.image) {
              const localImg = await downloadImage(image).catch(() => image);
              db.prepare("UPDATE posts SET image = ? WHERE id = ?").run(localImg || image, existing.id);
              updated++;
            }
          } else {
            const localImg = image ? await downloadImage(image).catch(() => image) : null;
            db.prepare("INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)").run(title, content, localImg || image, link, feed.name);
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
    const postsWithoutImages = db.prepare("SELECT * FROM posts WHERE image IS NULL OR image = ''").all();
    let fixed = 0;
    for (const post of postsWithoutImages) {
      const imgMatch = (post.content || "").match(/<img[^>]*src=["']([^"']+)["']/i);
      if (imgMatch) {
        const localImg = await downloadImage(imgMatch[1]).catch(() => imgMatch[1]);
        db.prepare("UPDATE posts SET image = ? WHERE id = ?").run(localImg || imgMatch[1], post.id);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server ON: http://localhost:${PORT}`));
