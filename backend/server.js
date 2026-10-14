const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
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
// A Vercel edge proxy fica à frente da função; um salto confiável para obter o IP do cliente.
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "https://comunidadedorock.com.br,https://www.comunidadedorock.com.br,http://localhost:5173")
    .split(",").map(origin => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    // Chamadas sem Origin incluem cron/health e clientes de servidor para servidor.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
}));
// Rate limit compartilhado entre instâncias serverless via PostgreSQL.
// Falha fechada: se o contador compartilhado estiver indisponível, não aceitar
// a requisição sem limite. A tabela é criada pela inicialização normal do schema.
function sharedRateLimit(name, windowMs, limit, message) {
  return async (req, res, next) => {
    try {
      await ensureInitialized();
      const ip = String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 128);
      const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
      const now = Date.now();
      const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
      const key = name + ":" + ipHash;
      const result = await pool.query(
        "INSERT INTO api_rate_limit_buckets (bucket_key, window_start, hit_count, expires_at) VALUES ($1, $2, 1, $3) ON CONFLICT (bucket_key, window_start) DO UPDATE SET hit_count = api_rate_limit_buckets.hit_count + 1 RETURNING hit_count",
        [key, windowStart, new Date(now + Math.max(windowMs * 2, 86400000))]
      );
      const count = Number(result.rows[0]?.hit_count || 0);
      res.setHeader("RateLimit-Limit", String(limit));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - count)));
      if (count > limit) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000))));
        return res.status(429).json({ error: message });
      }
      // Limpeza probabilística sem cron ou serviço adicional.
      if (Math.random() < 0.01) {
        pool.query("DELETE FROM api_rate_limit_buckets WHERE expires_at < NOW()").catch(() => {});
      }
      return next();
    } catch (err) {
      console.error("Rate limit compartilhado indisponível:", err.code || "DB_ERROR");
      return res.status(503).json({ error: "Proteção temporariamente indisponível. Tente novamente." });
    }
  };
}
const apiLimiter = sharedRateLimit("api", 60 * 1000, 180, "Muitas solicitações. Tente novamente em instantes.");
const authLimiter = sharedRateLimit("auth", 15 * 60 * 1000, 10, "Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.");
const uploadLimiter = sharedRateLimit("upload", 15 * 60 * 1000, 15, "Limite de envios de imagem atingido. Tente novamente mais tarde.");
const interactionLimiter = sharedRateLimit("interaction", 15 * 60 * 1000, 20, "Muitas solicitações. Aguarde e tente novamente.");
const bandSubmissionLimiter = sharedRateLimit("band-submission", 15 * 60 * 1000, 5, "Limite de inscrições de bandas atingido. Aguarde 15 minutos e tente novamente.");
app.use("/api", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/upload-image", uploadLimiter);
app.use("/api/comments", interactionLimiter);
app.use("/api/event-submissions", interactionLimiter);
app.use("/api/bands/submit", bandSubmissionLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
// Upload de imagem via base64
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
// Senhas novas usam scrypt com salt individual. Senhas legadas são migradas
// somente depois de um login válido, sem resetar contas existentes.
const scryptAsync = (password, salt, keylen = 64) => new Promise((resolve, reject) => {
  crypto.scrypt(String(password), salt, keylen, { N: 16384, r: 8, p: 1 }, (err, key) => {
    if (err) return reject(err);
    resolve(key);
  });
});
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt);
  return "scrypt$" + salt + "$" + key.toString("hex");
}
async function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || "");
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3 || !/^[a-f0-9]{32}$/i.test(parts[1]) || !/^[a-f0-9]{128}$/i.test(parts[2])) return false;
    const candidate = await scryptAsync(password, parts[1]);
    const expected = Buffer.from(parts[2], "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
  return stored.length > 0 && String(password) === stored;
}

const sharp = require("sharp");
const imagesDir = process.env.VERCEL ? path.join("/tmp", "comunidadedorock-images") : path.join(__dirname, "public", "images");
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
app.use("/images", express.static(imagesDir));
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
// BANCO POSTGRESQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : (process.env.DATABASE_URL ? { rejectUnauthorized: false } : false),
  // O Layerbase tem limite restrito de conexões simultâneas.
  // Em Vercel serverless, manter apenas uma conexão por instância e liberá-la
  // rapidamente reduz o risco de esgotar max_client_conn.
  max: 1,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL:", err.message);
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
  await db.run(`CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (bucket_key VARCHAR(160) NOT NULL, window_start TIMESTAMPTZ NOT NULL, hit_count INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (bucket_key, window_start))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_api_rate_limit_expiry ON api_rate_limit_buckets (expires_at)`);
  await db.run(`CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title TEXT, content TEXT, image TEXT, link TEXT, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT, is_weekly_featured BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  // Garante que bancos antigos recebam as colunas adicionadas depois da criação.
  await db.run(`ALTER TABLE bands ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.run(`ALTER TABLE bands ADD COLUMN IF NOT EXISTS is_weekly_featured BOOLEAN NOT NULL DEFAULT FALSE`);
  // Índice para acelerar a listagem das bandas novas por data.
  await db.run(`CREATE INDEX IF NOT EXISTS idx_bands_created_at ON bands (created_at DESC)`);
  await db.run(`CREATE TABLE IF NOT EXISTS pending_bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS rss_feeds (id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, logo TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS rss_feed_status (feed_id INTEGER PRIMARY KEY, feed_name TEXT NOT NULL, feed_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', message TEXT, imported_count INTEGER NOT NULL DEFAULT 0, updated_count INTEGER NOT NULL DEFAULT 0, item_count INTEGER NOT NULL DEFAULT 0, checked_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT, artist TEXT, date TEXT, time TEXT, location TEXT, city TEXT, state TEXT, image TEXT, ticket_link TEXT, ticket_location TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_location TEXT`);
  await db.run(`ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'`);
  await db.run(`ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_email TEXT`);
  await db.run(`CREATE TABLE IF NOT EXISTS interviews (id SERIAL PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, content TEXT, image TEXT, date TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS releases (id SERIAL PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, type TEXT DEFAULT 'Single', release_date TEXT, image TEXT, spotify TEXT, youtube TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, display_name TEXT, avatar TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_band BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.run(`CREATE TABLE IF NOT EXISTS band_claim_requests (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE, message TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ, UNIQUE (user_id, band_id))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_band_claim_requests_status ON band_claim_requests (status, created_at DESC)`);
  await db.run(`CREATE TABLE IF NOT EXISTS band_accounts (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, band_id), UNIQUE (band_id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS auth_sessions (id BIGSERIAL PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at)`);
  await db.run(`CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, page_type TEXT NOT NULL, page_id INTEGER NOT NULL, user_id INTEGER, user_name TEXT NOT NULL, user_avatar TEXT, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.run(`CREATE TABLE IF NOT EXISTS fan_favorite_bands (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, band_id))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_fan_favorite_bands_band_id ON fan_favorite_bands (band_id)`);
  await db.run(`CREATE TABLE IF NOT EXISTS fan_event_watchlist (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, event_id))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_fan_event_watchlist_event_id ON fan_event_watchlist (event_id)`);
  await db.run(`CREATE TABLE IF NOT EXISTS fan_weekly_votes (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, week_start DATE NOT NULL, band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, week_start))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_fan_weekly_votes_band_week ON fan_weekly_votes (band_id, week_start)`);
  await db.run(`CREATE TABLE IF NOT EXISTS fan_notifications (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'news', title TEXT NOT NULL, message TEXT, link TEXT, source_key TEXT, is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, source_key))`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_fan_notifications_user_created ON fan_notifications (user_id, created_at DESC)`);
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


// Notificações por e-mail usando o mesmo FormSubmit do formulário de contato.
async function notifyAdminByEmail(subject, details) {
  const replyTo = String(details?.["E-mail de contato"] || details?.email || details?.contact || "").trim();
  const payload = {
    ...details,
    ...( /^\S+@\S+\.\S+$/.test(replyTo) ? { _replyto: replyTo } : {}),
    _subject: subject,
    _template: "table"
  };

  try {
    const response = await fetchFunc("https://formsubmit.co/ajax/comunidadedorock@hotmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text().catch(() => "");
    let result = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error("[Email admin] FormSubmit respondeu com HTTP", response.status, "para:", subject, "| resposta:", responseText.slice(0, 1000));
      return false;
    }

    if (!result || result.success === "false" || result.success === false) {
      console.error("[Email admin] Resposta inesperada do FormSubmit para:", subject, "| resposta:", responseText.slice(0, 1000));
      return false;
    }

    console.log("[Email admin] FormSubmit aceitou a solicitação:", subject, "| HTTP:", response.status, "| sucesso:", result.success ?? "não informado", "| mensagem:", result.message ?? "não informada");
    return true;
  } catch (err) {
    console.error("[Email admin] Erro ao chamar FormSubmit para:", subject, "|", err.message);
    return false;
  }
}

// --- FUNÇÕES AUXILIARES ---

// Padroniza imagens de bandas no Cloudinary.
// URLs que já estão no Cloudinary são mantidas; URLs externas são importadas,
// e imagens Base64 são redimensionadas/comprimidas antes do upload.
async function migrateLegacyBandImage(band, table = "bands") {
  const original = band?.image;
  if (!original || typeof original !== "string") return original || null;
  if (!["bands", "pending_bands"].includes(table)) throw new Error("Tabela de imagens não permitida");
  // Nunca buscar nem importar URLs externas no servidor. Links remotos legados
  // continuam sendo exibidos como estão; apenas imagens Base64 enviadas em fluxos
  // autenticados/moderados podem ser processadas e enviadas ao Cloudinary.
  if (/^https?:\/\//i.test(original)) return original;

  try {
    let uploadSource = original;
    let imageBuffer;
      if (/^data:image\//i.test(original)) {
        const comma = original.indexOf(",");
        if (comma < 0) return original;
        imageBuffer = Buffer.from(original.slice(comma + 1), "base64");
      } else {
        const compact = original.replace(/\s/g, "");
        if (compact.length < 50000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return original;
        imageBuffer = Buffer.from(compact, "base64");
      }

      if (!imageBuffer.length) return original;

      // Comprime em tentativas progressivas para ficar abaixo do limite do Cloudinary.
      // Reprocessa sempre a imagem original e mantém margem abaixo do limite de 10 MB.
      const compressionAttempts = [
        { width: 1600, quality: 76 },
        { width: 1400, quality: 68 },
        { width: 1200, quality: 60 },
        { width: 1000, quality: 54 },
        { width: 800, quality: 48 },
        { width: 640, quality: 42 },
        { width: 480, quality: 38 }
      ];
      let optimized = null;
      for (const attempt of compressionAttempts) {
        const candidate = await sharp(imageBuffer, { limitInputPixels: 100000000 })
          .rotate()
          .resize({
            width: attempt.width,
            height: attempt.width,
            fit: "inside",
            withoutEnlargement: true
          })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: attempt.quality, mozjpeg: true })
          .toBuffer();

        if (!optimized || candidate.length < optimized.length) optimized = candidate;
        if (candidate.length <= 7 * 1024 * 1024) {
          optimized = candidate;
          break;
        }
      }

      if (!optimized || optimized.length > 7 * 1024 * 1024) {
        throw new Error("Não foi possível reduzir a imagem para menos de 7 MB");
      }
      uploadSource = "data:image/jpeg;base64," + optimized.toString("base64");

    const result = await cloudinary.uploader.upload(uploadSource, {
      folder: "comunidadedorock/bandas",
      public_id: (table === "pending_bands" ? "pending-band-" : "band-") + band.id,
      overwrite: true,
      resource_type: "image"
    });
    const url = result.secure_url;
    await db.run(`UPDATE ${table} SET image = $1 WHERE id = $2 AND image = $3`, [url, band.id, original]);
    return url;
  } catch (err) {
    console.warn("Não foi possível padronizar a imagem da banda " + band.id + ":", err.message);
    return original;
  }
}

// Prepara a imagem de uma inscrição pública sem chamar serviços externos.
// O envio ao Cloudinary fica para a aprovação administrativa.
async function preparePendingBandImage(image) {
  if (image == null || image === "") return null;
  if (typeof image !== "string") {
    const error = new Error("Imagem inválida. Envie uma imagem JPEG, PNG, WebP ou GIF.");
    error.code = "INVALID_BAND_IMAGE";
    throw error;
  }

  if (image.length > 7 * 1024 * 1024) {
    const error = new Error("A imagem enviada é muito grande. Escolha uma imagem menor que 5 MB.");
    error.code = "INVALID_BAND_IMAGE";
    throw error;
  }

  // Só aceitamos imagens já hospedadas no Cloudinary em URLs HTTPS confiáveis.
  if (/^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\//i.test(image)) return image;

  const match = image.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) {
    const error = new Error("Imagem inválida. Envie JPEG, PNG, WebP ou GIF; links externos não são aceitos.");
    error.code = "INVALID_BAND_IMAGE";
    throw error;
  }

  const imageBuffer = Buffer.from(match[2], "base64");
  if (!imageBuffer.length || imageBuffer.length > 5 * 1024 * 1024) {
    const error = new Error("A imagem deve ter no máximo 5 MB.");
    error.code = "INVALID_BAND_IMAGE";
    throw error;
  }

  try {
    const metadata = await sharp(imageBuffer, { limitInputPixels: 25000000 }).metadata();
    const expectedFormat = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
    if (!["jpeg", "png", "webp", "gif"].includes(metadata.format) ||
        metadata.format !== expectedFormat ||
        !metadata.width || !metadata.height ||
        metadata.width * metadata.height > 25000000) {
      throw new Error("Formato ou dimensões da imagem inválidos.");
    }

    let optimized = null;
    for (const attempt of [
      { width: 1200, quality: 72 },
      { width: 1000, quality: 62 },
      { width: 800, quality: 52 },
      { width: 640, quality: 42 }
    ]) {
      const candidate = await sharp(imageBuffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize({ width: attempt.width, height: attempt.width, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: attempt.quality, mozjpeg: true })
        .toBuffer();
      if (!optimized || candidate.length < optimized.length) optimized = candidate;
      if (candidate.length <= 1024 * 1024) {
        optimized = candidate;
        break;
      }
    }

    if (!optimized || optimized.length > 1024 * 1024) {
      throw new Error("Não foi possível reduzir a imagem. Escolha outra imagem menor.");
    }
    return "data:image/jpeg;base64," + optimized.toString("base64");
  } catch (cause) {
    const error = new Error(cause.message || "Não foi possível validar a imagem enviada.");
    error.code = "INVALID_BAND_IMAGE";
    throw error;
  }
}

// Evita depender do estado de memória de uma máquina/instância.
// Em Vercel, a função pode ser criada e encerrada entre requisições.
let initializationPromise = null;
let initializationStage = "not_started";
let initializationErrorCode = null;

async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      initializationStage = "creating_tables";
      initializationErrorCode = null;
      await initDb();
      initializationStage = "loading_feeds";
      await loadFeeds();
      initializationStage = "ready";
      // A limpeza de duplicatas não deve rodar em toda requisição/cold start.
      // Ela é executada somente pelo endpoint manual /api/cleanup-duplicates.
      return true;
    })().catch(err => {
      initializationStage = "failed";
      initializationErrorCode = typeof err.code === "string" ? err.code : "UNKNOWN";
      initializationPromise = null;
      throw err;
    });
  }
  return initializationPromise;
}


async function createFanNotificationsForPost(postId, title, content, link) {
  try {
    const haystack = (String(title || "") + " " + String(content || "")).toLocaleLowerCase("pt-BR");
    if (!haystack.trim()) return;
    const favorites = await db.getAll("SELECT f.user_id, b.name FROM fan_favorite_bands f JOIN bands b ON b.id = f.band_id WHERE LENGTH(TRIM(b.name)) >= 3");
    const notified = new Set();
    for (const favorite of favorites) {
      const name = String(favorite.name || "").trim();
      const key = name.toLocaleLowerCase("pt-BR");
      const userId = Number(favorite.user_id);
      if (!key || notified.has(userId) || !haystack.includes(key)) continue;
      notified.add(userId);
      await db.run("INSERT INTO fan_notifications (user_id, type, title, message, link, source_key) VALUES ($1, 'news', $2, $3, $4, $5) ON CONFLICT (user_id, source_key) DO NOTHING",
        [userId, "Notícia de uma banda favorita", `Uma notícia nova menciona ${name}.`, link || null, `post:${postId}`]);
    }
  } catch (err) {
    console.warn("Notificações de notícias não concluídas:", err.code || "DB_ERROR");
  }
}

async function postAlreadyExists(title, link) {
  if (link) {
    const byLink = await db.getOne("SELECT id FROM posts WHERE link = $1 LIMIT 1", [link]);
    if (byLink) return true;
  }
  if (title) {
    const byTitle = await db.getOne("SELECT id FROM posts WHERE title = $1 LIMIT 1", [title]);
    if (byTitle) return true;
  }
  return false;
}

async function cleanupDuplicatePosts() {
  const duplicateGroups = await db.getAll(
    "SELECT title, COUNT(*)::int AS total FROM posts WHERE title IS NOT NULL AND title <> '' GROUP BY title HAVING COUNT(*) > 1"
  );
  let total = 0;
  for (const group of duplicateGroups) {
    const rows = await db.getAll(
      "SELECT id FROM posts WHERE title = $1 ORDER BY id ASC",
      [group.title]
    );
    for (const row of rows.slice(1)) {
      await db.run("DELETE FROM posts WHERE id = $1", [row.id]);
      total++;
    }
  }
  return { total };
}

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

function generateSlug(text) {
  if (!text) return "";
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

function sanitizeImageUrl(url) {
  if (!url || url.includes("youtube.com/embed")) return "";
  let clean = url.trim();
  // Corrigir domínio duplicado (ex: https://site.com/site.com/path → https://site.com/path)
  clean = clean.replace(/(https?:\/\/[^\/]+)\/(www\.)?([^\/]+\.(com|net|org|br)[^\/]*)\//i, (match, proto, www, domain) => {
    if (match.includes(domain + "/" + domain) || match.includes(domain + "/www." + domain)) {
      return proto + "/";
    }
    return match;
  });
  // Corrigir URL duplicada mais agressivamente
  const dupeMatch = clean.match(/^(https?:\/\/[^\/]+)(\/(?:www\.)?[^\/]+\.[a-z]{2,})/i);
  if (dupeMatch) {
    const host = dupeMatch[1].replace(/^https?:\/\//, "").replace(/^www\./, "");
    const path = dupeMatch[2].replace(/^\/(?:www\.)?/, "");
    if (path.startsWith(host)) {
      clean = dupeMatch[1] + dupeMatch[2].replace(/\/(?:www\.)?[^\/]+\.[a-z]{2,}/, "");
    }
  }
  if (!clean.startsWith("http")) return "";
  return clean;
}

function extractRawContent(item) {
  let raw = item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] || 
            item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function extractContentFromItem(item) {
  let content = extractRawContent(item)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();

  if (content.length <= 10) return null;

  // RSS é usado como agregação de notícias: armazenamos apenas um resumo
  // para não reproduzir integralmente o conteúdo do site de origem.
  const maxLength = 600;
  if (content.length > maxLength) {
    content = content.slice(0, maxLength).replace(/\\s+\\S*$/, "").trim() + "...";
  }

  return content;
}

function extractImageFromItem(item, content) {
  // Pegar o HTML bruto do conteúdo (com tags, antes de limpar)
  const rawHtml = extractRawContent(item);
  const decoded = item.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  
  let image = item.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1] ||
              item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)?.[1] ||
              item.match(/<enclosure[^>]*url=["']([^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/i)?.[1] ||
              item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)?.[1] ||
              item.match(/<image>[^<]*<url>([^<]+)<\/url>/i)?.[1] ||
              rawHtml.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
              decoded.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
              item.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
              content?.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
              rawHtml.match(/src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/i)?.[1] ||
              rawHtml.match(/(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp))/i)?.[1] ||
              decoded.match(/(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp))/i)?.[1];
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

// Validar se imagem é real e acessível (com timeout curto)
async function isValidImage(imageUrl) {
  if (!imageUrl) return false;
  if (!imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) && !imageUrl.includes("uploads") && !imageUrl.includes("wp-content") && !imageUrl.includes("img") && !imageUrl.includes("media") && !imageUrl.includes("images") && !imageUrl.includes("photo")) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetchFunc(imageUrl, { method: "HEAD", headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("image");
  } catch (e) { return false; }
}

async function extractImageFromArticlePage(link) {
  if (!link || !/^https?:\/\//i.test(link)) return null;

  try {
    const url = new URL(link);
    const slug = url.pathname.split("/").filter(Boolean).pop();

    // Para WordPress, a forma mais confiável é consultar a API REST
    // e pegar exatamente a imagem destacada (featured_media) daquele post.
    if (slug) {
      try {
        const wpController = new AbortController();
        const wpTimeout = setTimeout(() => wpController.abort(), 6000);
        const wpPostsUrl = new URL("/wp-json/wp/v2/posts", url.origin);
        wpPostsUrl.searchParams.set("slug", slug);
        wpPostsUrl.searchParams.set("_fields", "featured_media");
        const wpResponse = await fetchFunc(wpPostsUrl.href, {
          headers: BROWSER_HEADERS,
          signal: wpController.signal
        });
        clearTimeout(wpTimeout);

        if (wpResponse.ok) {
          const posts = await wpResponse.json();
          const mediaId = posts?.[0]?.featured_media;
          if (mediaId) {
            const mediaController = new AbortController();
            const mediaTimeout = setTimeout(() => mediaController.abort(), 6000);
            const mediaResponse = await fetchFunc(
              new URL("/wp-json/wp/v2/media/" + mediaId, url.origin).href,
              { headers: BROWSER_HEADERS, signal: mediaController.signal }
            );
            clearTimeout(mediaTimeout);

            if (mediaResponse.ok) {
              const media = await mediaResponse.json();
              const featured = sanitizeImageUrl(media?.source_url);
              if (featured) return featured;
            }
          }
        }
      } catch (e) {
        // Continua com os métodos HTML abaixo como fallback.
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetchFunc(link, {
      headers: BROWSER_HEADERS,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const html = await response.text();

    const getMeta = (name) => {
      const tags = html.match(/<meta\b[^>]*>/gi) || [];
      for (const tag of tags) {
        const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
        const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
        if (key?.toLowerCase() === name.toLowerCase() && content) return content;
      }
      return null;
    };

    // JSON-LD do próprio artigo costuma apontar para a imagem destacada.
    const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of ldMatches) {
      try {
        const data = JSON.parse(match[1].trim());
        const nodes = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])];
        for (const node of nodes) {
          const image = node?.image;
          const candidates = Array.isArray(image) ? image : [image];
          for (const candidate of candidates) {
            const value = typeof candidate === "string" ? candidate : candidate?.url || candidate?.contentUrl;
            if (value) {
              const absolute = new URL(value, link).href;
              const clean = sanitizeImageUrl(absolute);
              if (clean) return clean;
            }
          }
        }
      } catch (e) {}
    }

    // Fallback: imagem do conteúdo do artigo, incluindo lazy-load.
    const articleHtml =
      html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
      html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
      html;

    const imageMatch = articleHtml.match(
      /<img[^>]+(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i
    );
    let image = imageMatch?.[1] || getMeta("twitter:image") || getMeta("og:image");

    if (image) {
      try { image = new URL(image, link).href; } catch (e) {}
    }

    return sanitizeImageUrl(image) || null;
  } catch (e) {
    return null;
  }
}

// Diagnóstico seguro: testa a conexão e a inicialização real usada pela API.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    // Diagnóstico temporário: a mensagem ajuda a identificar falhas de protocolo
    // sem expor a URL de conexão nem credenciais.
    console.error("Health check - banco:", {
      code: typeof err.code === "string" ? err.code : "UNKNOWN",
      message: String(err.message || "Erro sem mensagem").slice(0, 300)
    });
    return res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }

  try {
    await ensureInitialized();
    return res.json({ status: "ok", database: "connected", initialization: "ready" });
  } catch (err) {
    console.error("Health check - inicialização:", initializationStage, err.code || err.message);
    return res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }
});

// Inicializa o banco sob demanda na primeira requisição.
app.use(async (req, res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    const code = typeof err.code === "string" ? err.code : "UNKNOWN";
    const detail = String(err.message || "Erro sem mensagem").slice(0, 300);
    console.error("Falha ao inicializar backend:", {
      stage: initializationStage,
      code,
      detail
    });
    // Detalhes técnicos ficam apenas nos logs; a resposta pública é genérica.
    res.status(503).json({
      error: "Serviço temporariamente indisponível"
    });
  }
});

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
};

// Se o RSS for bloqueado ou não retornar itens, tenta a API pública do WordPress.
async function getFeedItems(feedUrl) {
  let rssError = null;
  try {
    const response = await fetchFunc(feedUrl, { headers: BROWSER_HEADERS });
    if (!response.ok) rssError = new Error("HTTP " + response.status + " ao acessar o feed");
    else {
      const xml = await response.text();
      const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
      if (items.length) return items;
      rssError = new Error("O endereço não retornou itens RSS/Atom");
    }
  } catch (err) { rssError = err; }

  let siteUrl;
  try { siteUrl = new URL(feedUrl); }
  catch { throw rssError || new Error("Endereço do feed inválido"); }

  const domain = siteUrl.hostname.replace(/^www\./i, "");

  // Alguns portais usam CMS próprio e não oferecem API WordPress.
  // Se o RSS/API falhar, tenta ler os links públicos da página de notícias.
  const pageCandidates = [
    new URL("/noticias/", siteUrl.origin).href,
    siteUrl.origin + "/"
  ];
  for (const pageUrl of pageCandidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response;
      try {
        response = await fetchFunc(pageUrl, { headers: BROWSER_HEADERS, signal: controller.signal });
      } finally { clearTimeout(timeout); }
      if (!response.ok) continue;
      const html = await response.text();
      const found = [];
      const seen = new Set();
      const anchorRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = anchorRegex.exec(html)) && found.length < 20) {
        let link;
        try { link = new URL(match[1], pageUrl); } catch { continue; }
        if (link.hostname.replace(/^www\./i, "") !== domain) continue;
        const title = match[2].replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const path = link.pathname.replace(/\/$/, "");
        if (title.length < 18 || path.length < 8 || seen.has(link.href)) continue;
        if (/\/(noticias|destaques|contato|sobre|anuncie|promocoes|page)\/?$/i.test(path)) continue;
        seen.add(link.href);
        const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        found.push("<item><title>" + safeTitle + "</title><link>" +
          link.href.replace(/&/g, "&amp;") + "</link></item>");
      }
      if (found.length) return found;
    } catch (err) {
      // Tenta a próxima página pública.
    }
  }

  const apiCandidates = [
    new URL("/wp-json/wp/v2/posts?per_page=10&_embed=1", siteUrl.origin).href,
    // WordPress sem pretty permalinks pode exigir o parâmetro rest_route.
    new URL("/?rest_route=/wp/v2/posts&per_page=10&_embed=1", siteUrl.origin).href,
    "https://public-api.wordpress.com/wp/v2/sites/" + encodeURIComponent(domain) + "/posts?per_page=10&_embed=1"
  ];
  let lastApiError = null;

  for (const apiUrl of apiCandidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let response;
      try {
        response = await fetchFunc(apiUrl, {
          headers: { ...BROWSER_HEADERS, "Accept": "application/json" },
          signal: controller.signal
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) {
        lastApiError = new Error("API WordPress HTTP " + response.status);
        continue;
      }
      const posts = await response.json();
      if (!Array.isArray(posts) || !posts.length) {
        lastApiError = new Error("API WordPress não retornou notícias");
        continue;
      }

      const escapeXml = value => String(value || "").replace(/&/g, "&amp;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
      return posts.map(post => {
        const title = post.title?.rendered || "";
        const content = post.content?.rendered || post.excerpt?.rendered || "";
        const image = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "";
        return "<item><title>" + escapeXml(title) + "</title><link>" +
          escapeXml(post.link || "") + "</link><pubDate>" +
          escapeXml(post.date || post.date_gmt || "") +
          "</pubDate><content:encoded><![CDATA[" +
          String(content).replace(/]]>/g, "]]]]><![CDATA[>") +
          "]]></content:encoded>" +
          (image ? '<media:content url="' + escapeXml(image) + '" />' : "") +
          "</item>";
      });
    } catch (err) { lastApiError = err; }
  }

  throw new Error((rssError?.message || "Falha ao acessar RSS") +
    "; alternativa WordPress indisponível: " + (lastApiError?.message || "sem resposta"));
}

// Guarda o último resultado por fonte para o painel administrativo, persistindo no Neon.
async function saveRssFeedStatus(feed, details = {}) {
  if (!feed?.id) return;
  const status = details.status || "error";
  const message = details.message || "";
  try {
    await db.run(
      "INSERT INTO rss_feed_status (feed_id, feed_name, feed_url, status, message, imported_count, updated_count, item_count, checked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) ON CONFLICT (feed_id) DO UPDATE SET feed_name = EXCLUDED.feed_name, feed_url = EXCLUDED.feed_url, status = EXCLUDED.status, message = EXCLUDED.message, imported_count = EXCLUDED.imported_count, updated_count = EXCLUDED.updated_count, item_count = EXCLUDED.item_count, checked_at = NOW()",
      [feed.id, feed.name || "Fonte RSS", feed.url || "", status, message, Number(details.imported || 0), Number(details.updated || 0), Number(details.items || 0)]
    );
  } catch (err) {
    console.warn("Não foi possível salvar status RSS de " + (feed.name || feed.url) + ":", err.message);
  }
}

let isImporting = false;
async function autoImportRss() {
  if (isImporting) return; // Evitar execuções sobrepostas
  isImporting = true;
  try {
    // Recarregar feeds do banco para pegar novos feeds adicionados
    try {
      rssFeeds = await db.getAll("SELECT * FROM rss_feeds");
    } catch (e) { console.warn("Erro ao recarregar feeds:", e.message); }
    for (const feed of rssFeeds) {
      let importedForFeed = 0;
      let itemCountForFeed = 0;
      try {
        // Tentar URL direta primeiro, se falhar tentar via proxy
        let xml = "";
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const directRes = await fetchFunc(feed.url, { headers: BROWSER_HEADERS, signal: controller.signal });
          clearTimeout(timeout);
          if (directRes.status === 200) {
            xml = await directRes.text();
          } else {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
            const proxyRes = await fetchFunc(proxyUrl);
            if (proxyRes.status === 200) xml = await proxyRes.text();
          }
        } catch (err) {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
          const proxyRes = await fetchFunc(proxyUrl).catch(() => null);
          if (proxyRes?.status === 200) xml = await proxyRes.text();
        }
        const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
        itemCountForFeed = items.length;
        if (!xml.trim()) {
          await saveRssFeedStatus(feed, { status: "error", message: "Não foi possível obter o conteúdo do feed (resposta vazia ou bloqueada).", items: 0 });
          continue;
        }
        if (items.length === 0) {
          await saveRssFeedStatus(feed, { status: "no_new", message: "O feed respondeu, mas não contém itens RSS reconhecidos.", items: 0 });
          continue;
        }
        
        // Examinar até 10 itens por fonte para pular notícias antigas ou sem imagem.
        // Importar no máximo 3 notícias novas e válidas por fonte em cada execução.
        for (const itemXml of items.slice(0, 10)) {
          if (importedForFeed >= 3) break;
          const rawTitle = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
          const title = decodeHtmlEntities(rawTitle);
          if (!title) continue;

          const link = extractLinkFromItem(itemXml);
          const content = decodeHtmlEntities(extractContentFromItem(itemXml));
          const rssImage = extractImageFromItem(itemXml, content);
          const articleImage = await extractImageFromArticlePage(link);
          const image = articleImage || rssImage;

          if (!image) continue;
          if (!(await isValidImage(image))) continue;

          const existing = await db.getOne("SELECT id, image FROM posts WHERE title = $1 OR link = $2 LIMIT 1", [title, link]);
          if (existing) {
            if (existing.image !== image) {
              await db.run("UPDATE posts SET image = $1 WHERE id = $2", [image, existing.id]);
              console.log(`🖼️ Imagem corrigida: ${title.substring(0, 30)}`);
            }
            continue;
          }

          await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)",
            [title, content, image, link, feed.name]);
          importedForFeed++;
          console.log(`✅ Importado: ${title.substring(0, 30)}`);
        }
        await saveRssFeedStatus(feed, {
          status: importedForFeed > 0 ? "updated" : "no_new",
          message: importedForFeed > 0 ? `${importedForFeed} notícia(s) nova(s) importada(s).` : "Nenhuma notícia nova com imagem válida entre os 10 primeiros itens do feed.",
          imported: importedForFeed,
          items: itemCountForFeed
        });
      } catch (e) {
        console.warn(`Erro no feed ${feed.name}: ${e.message}`);
        await saveRssFeedStatus(feed, { status: "error", message: e.message, imported: importedForFeed, items: itemCountForFeed });
      }
    }
    // Limpar notícias sem imagem e limitar cada fonte às 3 mais recentes.
    try {
      await pool.query("DELETE FROM posts WHERE image IS NULL OR image = '' OR image NOT LIKE 'http%'");
      await cleanupRssPostsPerSource();
    } catch (e) { console.warn("Erro ao limitar notícias por fonte:", e.message); }
  } finally {
    isImporting = false;
  }
}
// Não executar importação RSS em loop dentro da Vercel Serverless Function.\n// A importação é disparada exclusivamente pelo endpoint /api/cron/rss via GitHub Actions.\n// Isso evita chamadas externas contínuas que podem derrubar a Function e fazer o conteúdo da API parecer indisponível.



// Mantém no máximo as 3 notícias mais recentes de cada fonte RSS.
// Publicações próprias (source vazio) não são afetadas.
async function cleanupRssPostsPerSource() {
  await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY source
        ORDER BY created_at DESC NULLS LAST, id DESC
      ) AS position
      FROM posts
      WHERE source IS NOT NULL AND TRIM(source) <> ''
    )
    DELETE FROM posts
    WHERE id IN (SELECT id FROM ranked WHERE position > 3)
  `);
}

// --- SEGURANÇA DE SESSÃO E AUTORIZAÇÃO ---
// Token aleatório de curta duração; somente o hash é persistido no banco.
// O frontend envia o token no cabeçalho Authorization (nunca confiar no objeto user do localStorage).
const SESSION_TTL_HOURS = 8;
function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.run("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
  await db.run("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hashSessionToken(token), userId, expiresAt]);
  return token;
}
function bearerToken(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  return match ? match[1] : null;
}
async function authenticate(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "Autenticação necessária" });
  try {
    const user = await db.getOne(
      "SELECT u.id, u.username, u.display_name, u.avatar, u.role, u.is_band, u.created_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()",
      [hashSessionToken(token)]
    );
    if (!user) return res.status(401).json({ error: "Sessão inválida ou expirada" });
    req.authUser = user;
    req.authTokenHash = hashSessionToken(token);
    return next();
  } catch (err) {
    console.error("Falha ao validar sessão:", err.code || "UNKNOWN");
    return res.status(503).json({ error: "Não foi possível validar a sessão" });
  }
}
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: "Autenticação necessária" });
    if (!roles.includes(req.authUser.role)) return res.status(403).json({ error: "Acesso não autorizado" });
    return next();
  };
}
function isPath(path, pattern) { return pattern.test(path); }

// Política central: nenhuma rota de escrita fica pública por omissão.
// Exceções públicas são explícitas; /api/cron/rss conserva sua validação CRON_SECRET.
app.use("/api", async (req, res, next) => {
  const path = req.path;
  const method = req.method.toUpperCase();
  if (path === "/health" || path === "/login" || path === "/register" ||
      path === "/cron/rss") return next();
  if (path === "/fan/data" || /^\/fan\/(favorites|events|vote|notifications)(?:\/\d+(?:\/read)?)?$/.test(path)) return authenticate(req, res, next);
  if (path === "/logout" && method === "POST") return authenticate(req, res, next);
  if (path === "/session" && method === "GET") return authenticate(req, res, next);

  const isUserProfile = isPath(path, /^\/user\/\d+$/);
  const isCommentDelete = isPath(path, /^\/comments\/\d+$/) && method === "DELETE";
  const isPublicRead = method === "GET" && (
    path === "/votacao" ||
    /^\/(posts|bands|band-genres|interviews|releases|events|rss-feeds|comments\/[^/]+\/\d+)$/.test(path) ||
    /^\/posts\/\d+$/.test(path) ||
    /^\/bands\/[^/]+$/.test(path) ||
    /^\/interviews\/\d+$/.test(path) ||
    /^\/releases\/\d+$/.test(path) ||
    /^\/events\/\d+$/.test(path)
  );
  if (isPublicRead) {
    if ((path === "/events" && req.query.full === "1") ||
        (path === "/bands" && req.query.full === "1")) {
      return authenticate(req, res, () => requireRoles("admin")(req, res, next));
    }
    if ((path === "/posts" && req.query.full === "1") ||
        (path === "/interviews" && req.query.full === "1") ||
        (path === "/releases" && req.query.full === "1")) {
      return authenticate(req, res, () => requireRoles("admin", "editor")(req, res, next));
    }
    return next();
  }

  if (method === "GET" && path === "/debug-rss") {
    return authenticate(req, res, () => requireRoles("admin", "editor")(req, res, next));
  }
  if (path === "/band-claims/mine" && method === "GET") return authenticate(req, res, next);
  if (path === "/my-band" && (method === "GET" || method === "PUT")) return authenticate(req, res, next);
  if (path === "/band-claims" && method === "POST") return authenticate(req, res, (req, res, next) => {
    if (!req.authUser.is_band) return res.status(403).json({ error: "Esta função está disponível apenas para contas de banda." });
    return next();
  });
  if (method === "GET" && ["/users", "/pending-bands", "/band-claims"].includes(path)) {
    return authenticate(req, res, () => requireRoles("admin")(req, res, next));
  }
  if (method === "GET" && path === "/rss-status") {
    return authenticate(req, res, () => requireRoles("admin", "editor")(req, res, next));
  }
  if (isUserProfile && (method === "GET" || method === "PUT")) {
    return authenticate(req, res, () => {
      if (String(req.authUser.id) !== req.params?.id && String(req.authUser.id) !== path.split("/")[2] && req.authUser.role !== "admin") {
        return res.status(403).json({ error: "Você só pode acessar seu próprio perfil" });
      }
      return next();
    });
  }
  if (isCommentDelete) {
    return authenticate(req, res, next);
  }
  if (method === "POST" && path === "/event-submissions") {
    return authenticate(req, res, next);
  }
  if (method === "POST" && path === "/comments") {
    return authenticate(req, res, next);
  }
  if (method === "POST" && path === "/upload-image") {
    return authenticate(req, res, () => requireRoles("admin", "editor")(req, res, next));
  }

  return authenticate(req, res, () => {
    // Ações de administração e manutenção são exclusivas de admin.
    const adminOnly =
      /^\/(user\/\d+\/role|users?|pending-bands|band-claims\\/\\d+|approve-band\/\d+|rss-feeds|import-rss(?:-single)?|reimport-rss|fix-html-entities|fix-missing-images|test-rss-images|cleanup-duplicates|posts-without-images|debug-rss|rss-status)(?:\/|$)/.test(path) ||
      /^\/events\/\d+\/status$/.test(path) ||
      /^\/bands\/\d+\/weekly-featured$/.test(path) ||
      (method !== "GET" && /^\/(bands|events)(?:\/|$)/.test(path));
    if (adminOnly) return requireRoles("admin")(req, res, next);
    const editorAllowed = ["admin", "editor"];
    if (method !== "GET" && /^\/(posts|interviews|releases)(?:\/|$)/.test(path)) {
      return requireRoles(...editorAllowed)(req, res, next);
    }
    if (path === "/comments" && method === "POST") return next();
    if (isCommentDelete) return next();
    return requireRoles("admin")(req, res, next);
  });
});

// Upload fica registrado depois do middleware central de autenticação/autorização.
app.post("/api/upload-image", async (req, res) => {
  try {
    const { image } = req.body;
    if (typeof image !== "string") {
      return res.status(400).json({ error: "Envie uma imagem válida" });
    }
    if (image.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "A imagem excede o limite permitido" });
    }
    const match = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(image);
    if (!match) {
      return res.status(400).json({ error: "Formato de imagem não permitido" });
    }
    const imageBuffer = Buffer.from(match[2], "base64");
    if (!imageBuffer.length || imageBuffer.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) {
      return res.status(400).json({ error: "Conteúdo de imagem inválido" });
    }
    let metadata;
    try {
      metadata = await sharp(imageBuffer, { limitInputPixels: 40000000 }).metadata();
    } catch {
      return res.status(400).json({ error: "Arquivo de imagem inválido" });
    }
    const declaredFormat = match[1].toLowerCase().replace("jpg", "jpeg");
    if (!["jpeg", "png", "webp", "gif"].includes(metadata.format) || metadata.format !== declaredFormat) {
      return res.status(400).json({ error: "O conteúdo não corresponde ao formato declarado" });
    }
    const result = await cloudinary.uploader.upload(image, {
      folder: "comunidadedorock",
      resource_type: "image"
    });
    return res.json({ success: true, path: result.secure_url });
  } catch (err) {
    console.error("Erro no upload de imagem:", err.message);
    return res.status(500).json({ error: "Não foi possível enviar a imagem" });
  }
});

// --- ROTAS DA API ---

// Autenticação
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, display_name, is_band } = req.body;
    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
    }
    if (username.trim().length < 3 || username.length > 100) {
      return res.status(400).json({ error: "Usuário deve ter entre 3 e 100 caracteres" });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Senha deve ter entre 8 e 128 caracteres" });
    }
    const exists = await db.getOne("SELECT id FROM users WHERE username = $1", [username.toLowerCase()]);
    if (exists) return res.status(409).json({ error: "Usuário já existe" });
    const result = await pool.query(
      "INSERT INTO users (username, password, display_name, role, is_band) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name, avatar, role, is_band, created_at",
      [username.toLowerCase(), await hashPassword(password), display_name || username, "user", Boolean(is_band)]
    );
    const token = await createSession(result.rows[0].id);
    res.json({ success: true, token, user: result.rows[0] });
  } catch (err) {
    console.error("Erro no cadastro:", err.code || "UNKNOWN");
    res.status(500).json({ error: "Não foi possível concluir o cadastro" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { user, pass } = req.body || {};
    // Limitar os valores antes de consultar o banco ou executar scrypt.
    if (typeof user !== "string" || user.length > 100 || typeof pass !== "string" || pass.length > 128) {
      return res.status(400).json({ success: false, error: "Usuário ou senha inválidos" });
    }
    // Nunca criar conta administrativa com senha padrão durante um login.
    const found = await db.getOne("SELECT * FROM users WHERE username = $1", [user.toLowerCase()]);
    if (!found || !(await verifyPassword(pass, found.password))) {
      return res.status(401).json({ success: false, error: "Usuário ou senha incorretos" });
    }
    // Migrar senha legada somente após autenticação válida, sem resetar a conta.
    if (!String(found.password || "").startsWith("scrypt$")) {
      const migratedPassword = await hashPassword(pass);
      await db.run("UPDATE users SET password = $1 WHERE id = $2", [migratedPassword, found.id]);
      found.password = migratedPassword;
    }
    const token = await createSession(found.id);
    res.json({ success: true, token, user: { id: found.id, username: found.username, display_name: found.display_name, avatar: found.avatar, role: found.role, is_band: Boolean(found.is_band), created_at: found.created_at } });
  } catch (err) {
    console.error("Erro no login:", err.code || "UNKNOWN");
    res.status(500).json({ error: "Não foi possível concluir o login" });
  }
});

app.post("/api/logout", authenticate, async (req, res) => {
  try {
    await db.run("DELETE FROM auth_sessions WHERE token_hash = $1", [req.authTokenHash]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Não foi possível encerrar a sessão" });
  }
});

app.get("/api/session", authenticate, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ user: req.authUser });
});

function isValidPositiveId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

app.get("/api/user/:id", async (req, res) => {
  if (!isValidPositiveId(req.params.id)) return res.status(400).json({ error: "ID de usuário inválido" });
  try {
    const user = await db.getOne("SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.put("/api/user/:id", async (req, res) => {
  if (!isValidPositiveId(req.params.id)) return res.status(400).json({ error: "ID de usuário inválido" });
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Dados de perfil inválidos" });
  }
  try {
    const { display_name, username, avatar, new_password, current_password } = req.body;
    if (username !== undefined && (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 100)) {
      return res.status(400).json({ error: "Nome de usuário deve ter entre 3 e 100 caracteres" });
    }
    if (display_name !== undefined && (typeof display_name !== "string" || display_name.length > 100)) {
      return res.status(400).json({ error: "Nome de exibição inválido" });
    }
    if (avatar !== undefined && (typeof avatar !== "string" || avatar.length > 2048)) {
      return res.status(400).json({ error: "Avatar inválido" });
    }
    if (new_password && (typeof new_password !== "string" || new_password.length < 8 || new_password.length > 128)) {
      return res.status(400).json({ error: "Nova senha deve ter entre 8 e 128 caracteres" });
    }
    if (new_password && (typeof current_password !== "string" || current_password.length > 128)) {
      return res.status(400).json({ error: "Senha atual inválida" });
    }
    const user = await db.getOne("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (new_password) {
      if (!current_password || !(await verifyPassword(current_password, user.password))) {
        return res.status(403).json({ error: "Senha atual incorreta" });
      }
      if (new_password.length < 8) return res.status(400).json({ error: "Nova senha deve ter pelo menos 8 caracteres" });
      await db.run("UPDATE users SET password = $1 WHERE id = $2", [await hashPassword(new_password), req.params.id]);
      // Invalidar outras sessões da conta após a troca de senha, preservando esta requisição.
      if (req.authTokenHash) {
        await db.run("DELETE FROM auth_sessions WHERE user_id = $1 AND token_hash <> $2", [req.params.id, req.authTokenHash]);
      }
    }
    if (username !== undefined && username.trim().toLowerCase() !== user.username) {
      const normalizedUsername = username.trim().toLowerCase();
      const exists = await db.getOne("SELECT id FROM users WHERE username = $1 AND id != $2", [normalizedUsername, req.params.id]);
      if (exists) return res.status(409).json({ error: "Este nome de usuário já está em uso" });
      await db.run("UPDATE users SET username = $1 WHERE id = $2", [normalizedUsername, req.params.id]);
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
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

// Gerenciamento de usuários (admin)
app.get("/api/users", async (req, res) => {
  try {
    res.json(await db.getAll("SELECT id, username, display_name, avatar, role, created_at FROM users ORDER BY created_at DESC"));
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.put("/api/user/:id/role", async (req, res) => {
  if (!isValidPositiveId(req.params.id)) return res.status(400).json({ error: "ID de usuário inválido" });
  try {
    const { role } = req.body;
    if (!["admin", "editor", "user"].includes(role)) return res.status(400).json({ error: "Role inválida" });
    await db.run("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);
    const updated = await db.getOne("SELECT id, username, display_name, avatar, role, created_at FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.delete("/api/user/:id", async (req, res) => {
  if (!isValidPositiveId(req.params.id)) return res.status(400).json({ error: "ID de usuário inválido" });
  try {
    const user = await db.getOne("SELECT role FROM users WHERE id = $1", [req.params.id]);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (user.role === "admin") return res.status(403).json({ error: "Não é possível deletar um admin" });
    await db.run("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

// Solicitações seguras de acesso ao perfil de uma banda.
app.get("/api/band-claims/mine", async (req, res) => {
  try {
    const claims = await db.getAll(`SELECT r.id, r.band_id, b.name AS band_name, r.message, r.status, r.created_at, r.reviewed_at FROM band_claim_requests r JOIN bands b ON b.id = r.band_id WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [req.authUser.id]);
    const managedBands = await db.getAll(`SELECT b.id, b.name, b.genre, b.city, b.state FROM band_accounts a JOIN bands b ON b.id = a.band_id WHERE a.user_id = $1 ORDER BY b.name`, [req.authUser.id]);
    res.set("Cache-Control", "no-store");
    res.json({ claims, bands: managedBands });
  } catch (err) { res.status(500).json({ error: "Não foi possível carregar suas solicitações." }); }
});
app.post("/api/band-claims", async (req, res) => {
  const bandId = req.body?.band_id;
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 1000) : "";
  if (!isValidPositiveId(bandId)) return res.status(400).json({ error: "Selecione uma banda válida." });
  try {
    const band = await db.getOne("SELECT id FROM bands WHERE id = $1", [bandId]);
    if (!band) return res.status(404).json({ error: "Banda não encontrada." });
    const alreadyManaged = await db.getOne("SELECT user_id FROM band_accounts WHERE band_id = $1", [bandId]);
    if (alreadyManaged) return res.status(409).json({ error: "Esta banda já possui um representante vinculado. Entre em contato com a administração." });
    const existing = await db.getOne("SELECT id, status FROM band_claim_requests WHERE user_id = $1 AND band_id = $2", [req.authUser.id, bandId]);
    if (existing?.status === "pending") return res.status(409).json({ error: "Você já tem uma solicitação pendente para esta banda." });
    if (existing?.status === "approved") return res.status(409).json({ error: "Esta solicitação já foi aprovada." });
    const result = await db.getOne(`INSERT INTO band_claim_requests (user_id, band_id, message, status, created_at, reviewed_at) VALUES ($1, $2, $3, 'pending', NOW(), NULL) ON CONFLICT (user_id, band_id) DO UPDATE SET message = EXCLUDED.message, status = 'pending', created_at = NOW(), reviewed_at = NULL RETURNING id, band_id, message, status, created_at`, [req.authUser.id, bandId, message]);
    res.status(201).json({ success: true, claim: result, message: "Solicitação enviada para análise da Comunidade do Rock." });
  } catch (err) { console.error("Falha ao solicitar acesso à banda:", err.code || "DB_ERROR"); res.status(500).json({ error: "Não foi possível enviar a solicitação." }); }
});
app.get("/api/band-claims", async (req, res) => {
  try {
    const claims = await db.getAll(`SELECT r.id, r.user_id, r.band_id, r.message, r.status, r.created_at, u.username, u.display_name, u.is_band, b.name AS band_name FROM band_claim_requests r JOIN users u ON u.id = r.user_id JOIN bands b ON b.id = r.band_id ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`);
    res.json(claims);
  } catch (err) { res.status(500).json({ error: "Não foi possível carregar as solicitações." }); }
});
app.patch("/api/band-claims/:id", async (req, res) => {
  if (!isValidPositiveId(req.params.id)) return res.status(400).json({ error: "Solicitação inválida." });
  const status = req.body?.status;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Decisão inválida." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM band_claim_requests WHERE id = $1 FOR UPDATE", [req.params.id]);
    const claim = result.rows[0];
    if (!claim) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Solicitação não encontrada." }); }
    if (status === "approved") {
      const existing = await client.query("SELECT user_id FROM band_accounts WHERE band_id = $1 FOR UPDATE", [claim.band_id]);
      if (existing.rows.length && Number(existing.rows[0].user_id) !== Number(claim.user_id)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Esta banda já está vinculada a outra conta." });
      }
      await client.query("INSERT INTO band_accounts (user_id, band_id) VALUES ($1, $2) ON CONFLICT (user_id, band_id) DO NOTHING", [claim.user_id, claim.band_id]);
    }
    await client.query("UPDATE band_claim_requests SET status = $1, reviewed_at = NOW() WHERE id = $2", [status, claim.id]);
    await client.query("COMMIT");
    res.json({ success: true, status });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Falha ao revisar solicitação de banda:", err.code || "DB_ERROR");
    res.status(500).json({ error: "Não foi possível revisar a solicitação." });
  } finally { client.release(); }
});
app.get("/api/my-band", async (req, res) => {
  try {
    const band = await db.getOne(`SELECT b.* FROM band_accounts a JOIN bands b ON b.id = a.band_id WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 1`, [req.authUser.id]);
    if (!band) return res.status(404).json({ error: "Sua conta ainda não tem uma banda aprovada vinculada." });
    res.set("Cache-Control", "no-store");
    res.json(band);
  } catch (err) { res.status(500).json({ error: "Não foi possível carregar o perfil da banda." }); }
});
app.put("/api/my-band", async (req, res) => {
  const fields = ["name", "genre", "city", "state", "year", "members", "biography", "contact", "image", "instagram", "facebook", "youtube", "spotify", "bandcamp", "site"];
  const values = fields.map(field => typeof req.body?.[field] === "string" ? req.body[field].trim().slice(0, field === "biography" ? 12000 : field === "members" ? 5000 : 2000) : "");
  try {
    const association = await db.getOne("SELECT band_id FROM band_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.authUser.id]);
    if (!association) return res.status(403).json({ error: "O acesso ao perfil da banda precisa ser aprovado pela administração." });
    const current = await db.getOne("SELECT * FROM bands WHERE id = $1", [association.band_id]);
    if (!current) return res.status(404).json({ error: "Banda não encontrada." });
    const merged = fields.map((field, index) => req.body?.[field] === undefined ? current[field] : values[index]);
    const result = await db.getOne(`UPDATE bands SET name = $1, genre = $2, city = $3, state = $4, year = $5, members = $6, biography = $7, contact = $8, image = $9, instagram = $10, facebook = $11, youtube = $12, spotify = $13, bandcamp = $14, site = $15 WHERE id = $16 RETURNING *`, [...merged, association.band_id]);
    res.json({ success: true, band: result });
  } catch (err) { console.error("Falha ao atualizar perfil próprio de banda:", err.code || "DB_ERROR"); res.status(500).json({ error: "Não foi possível salvar o perfil da banda." }); }
});

// Posts
app.get("/api/posts", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const search = req.query.search || null;
    const source = req.query.source || null;
    
    const full = req.query.full === "1";
    let query = full
      ? "SELECT * FROM posts WHERE 1=1"
      : "SELECT id, title, image, link, source, created_at, LEFT(REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g'), 500) AS summary FROM posts WHERE 1=1";
    let params = [];
    let paramIdx = 1;
    
    if (search) {
      query += ` AND (title ILIKE $${paramIdx} OR content ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    
    if (source) {
      if (source === "__manual__") {
        query += " AND (source IS NULL OR source = '')";
      } else {
        query += ` AND source ILIKE $${paramIdx}`;
        params.push(`%${source}%`);
        paramIdx++;
      }
    }
    
    query += " ORDER BY created_at DESC NULLS LAST, id DESC";
    
    if (limit !== null) {
      query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      params.push(limit, offset);
    }
    
    const posts = await db.getAll(query, params);
    const mkSlug = (t) => t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").substring(0,80) : "";
    
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json(posts.map(p => ({ ...p, slug: mkSlug(p.title) })));
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/posts", async (req, res) => {
  const { title, content, image, link, source } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  await db.run("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5)", [title, content, image || null, link || null, source || null]);
  res.json({ success: true });
});

app.put("/api/posts/:id", async (req, res) => {
  const { title, content, image, link, source } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Título e conteúdo são obrigatórios" });
  await db.run("UPDATE posts SET title = $1, content = $2, image = $3, link = $4, source = $5 WHERE id = $6", [title, content, image || null, link || null, source || null, req.params.id]);
  res.json({ success: true });
});

app.delete("/api/posts/:id", async (req, res) => {
  await db.run("DELETE FROM posts WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// Bandas
app.get("/api/band-genres", async (req, res) => {
  try {
    res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    const rows = await db.getAll("SELECT DISTINCT genre FROM bands WHERE genre IS NOT NULL AND TRIM(genre) <> '' ORDER BY genre ASC");
    res.json(rows.map(row => row.genre));
  } catch (err) {
    console.error("Erro ao buscar gêneros:", err.message);
    res.status(500).json({ error: "Erro ao carregar gêneros" });
  }
});

// Detalhe público: busca somente a banda solicitada, sem baixar a tabela inteira.
app.get("/api/bands/:id", async (req, res) => {
  try {
    const key = req.params.id;
    let band = null;
    if (/^\d+$/.test(key)) {
      band = await db.getOne("SELECT * FROM bands WHERE id = $1", [Number(key)]);
    } else {
      const slugExpression = "regexp_replace(regexp_replace(translate(lower(name), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g')";
      band = await db.getOne(`SELECT * FROM bands WHERE ${slugExpression} = $1 LIMIT 1`, [key]);
    }
    if (!band) return res.status(404).json({ error: "Banda não encontrada" });
    // Leitura pública não deve disparar migração/upload de imagem.
    // Imagens legadas permanecem exibidas pela URL original até uma edição autorizada.
    const slug = band.name ? band.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").substring(0,80) : "";
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ ...band, slug });
  } catch (err) {
    console.error("Erro ao buscar banda:", err.message);
    res.status(500).json({ error: "Erro ao carregar banda" });
  }
});

app.get("/api/bands", async (req, res) => {
  try {
    const full = req.query.full === "1";
    const orderBy = req.query.sort === "featured"
      ? "is_weekly_featured DESC, created_at DESC NULLS LAST, id DESC"
      : req.query.sort === "recent"
        ? "created_at DESC NULLS LAST, id DESC"
        : "name ASC";
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = full ? null : Math.max(1, Math.min(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 12, 50));
    const requestedOffset = parseInt(req.query.offset, 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.min(requestedOffset, 100000) : 0;
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const genre = typeof req.query.genre === "string" ? req.query.genre.trim().slice(0, 100) : "";
    const fields = full
      ? "*"
      : "id, name, genre, city, state, year, image, instagram, facebook, youtube, spotify, bandcamp, site, is_weekly_featured, created_at";
    const conditions = [];
    const params = [];
    if (search) {
      params.push("%" + search + "%");
      conditions.push(`(name ILIKE $${params.length} OR genre ILIKE $${params.length} OR city ILIKE $${params.length})`);
    }
    if (genre) {
      params.push(genre);
      conditions.push(`genre = $${params.length}`);
    }
    let sql = `SELECT ${fields} FROM bands`;
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += ` ORDER BY ${orderBy}`;
    if (limit) {
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
    }
    const bands = await db.getAll(sql, params);
    const mkSlug = (t) => t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").substring(0,80) : "";
    // Listagem pública é somente leitura: não deve provocar uploads ou migrações
    // de imagens no Cloudinary durante um GET.
    const responseBands = bands.map((band) => ({
      ...band,
      image: band.image,
      slug: mkSlug(band.name)
    }));
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json(responseBands);
  } catch (err) {
    console.error("Erro ao buscar bandas:", err.message);
    res.status(500).json({ error: "Erro ao carregar bandas" });
  }
});

app.post("/api/bands", async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
    const inserted = await db.getOne(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site]);
    const image = await migrateLegacyBandImage({ id: inserted.id, image: b.image }, "bands");
    res.json({ success: true, image });
  } catch (err) {
    console.error("Erro ao cadastrar banda:", err.message);
    res.status(500).json({ error: "Não foi possível cadastrar a banda" });
  }
});

app.put("/api/bands/:id", async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: "Nome da banda é obrigatório" });
    await db.run(`UPDATE bands SET name=$1, genre=$2, city=$3, state=$4, year=$5, members=$6, biography=$7, contact=$8, image=$9, instagram=$10, facebook=$11, youtube=$12, spotify=$13, bandcamp=$14, site=$15 WHERE id=$16`,
      [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, b.image, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site, req.params.id]);
    const image = await migrateLegacyBandImage({ id: req.params.id, image: b.image }, "bands");
    res.json({ success: true, image });
  } catch (err) {
    console.error("Erro ao atualizar banda:", err.message);
    res.status(500).json({ error: "Não foi possível atualizar a banda" });
  }
});

app.post("/api/bands/:id/weekly-featured", async (req, res) => {
  try {
    const bandId = Number(req.params.id);
    const featured = req.body?.featured === true;
    if (!Number.isInteger(bandId) || bandId <= 0) {
      return res.status(400).json({ error: "ID de banda inválido" });
    }
    const band = await db.getOne("SELECT id FROM bands WHERE id = $1", [bandId]);
    if (!band) return res.status(404).json({ error: "Banda não encontrada" });

    // Uma única instrução garante que exista no máximo uma Banda da Semana.
    if (featured) {
      await db.run("UPDATE bands SET is_weekly_featured = (id = $1)", [bandId]);
    } else {
      await db.run("UPDATE bands SET is_weekly_featured = FALSE WHERE id = $1", [bandId]);
    }
    res.json({ success: true, id: bandId, is_weekly_featured: featured });
  } catch (err) {
    console.error("Erro ao definir Banda da Semana:", err.message);
    res.status(500).json({ error: "Não foi possível atualizar a Banda da Semana" });
  }
});

app.delete("/api/bands/:id", async (req, res) => {
  await db.run("DELETE FROM bands WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

app.post("/api/bands/submit", async (req, res) => {
  try {
    const b = req.body;
    if (!b || typeof b !== "object" || Array.isArray(b) || !b.name) {
      return res.status(400).json({ error: "Nome da banda é obrigatório" });
    }
    let pendingImage;
    try {
      pendingImage = await preparePendingBandImage(b.image);
    } catch (imageError) {
      if (imageError.code === "INVALID_BAND_IMAGE") {
        return res.status(400).json({ error: imageError.message });
      }
      throw imageError;
    }
    const inserted = await db.getOne(`INSERT INTO pending_bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [b.name, b.genre, b.city, b.state, b.year, b.members, b.biography, b.contact, pendingImage, b.instagram, b.facebook, b.youtube, b.spotify, b.bandcamp, b.site]);
    // Dispara o aviso assim que a inscrição é gravada, antes de processar a imagem.
    await notifyAdminByEmail("Nova banda aguardando aprovação", {
      "Banda": b.name, "Estilo": b.genre, "Cidade": [b.city, b.state].filter(Boolean).join(" / "),
      "Ano de formação": b.year, "Integrantes": b.members, "Contato": b.contact,
      "Instagram": b.instagram, "Facebook": b.facebook, "YouTube": b.youtube, "Site": b.site,
      "ID da inscrição": inserted.id
    });
    // Nenhum upload externo na inscrição pública: a imagem validada fica compactada
    // na fila pendente e só é enviada ao Cloudinary quando um administrador aprova.
    res.json({ success: true, id: inserted.id, message: "Banda cadastrada com sucesso! Aguarde a aprovação." });
  } catch (err) {
    console.error("Erro ao enviar banda para aprovação:", err.message);
    res.status(500).json({ error: "Não foi possível cadastrar a banda" });
  }
});

app.get("/api/pending-bands", async (req, res) => {
  res.json(await db.getAll("SELECT * FROM pending_bands"));
});

app.post("/api/approve-band/:id", async (req, res) => {
  try {
    const band = await db.getOne("SELECT * FROM pending_bands WHERE id = $1", [req.params.id]);
    if (!band) return res.status(404).send();

    // Linhas antigas da fila podem conter URLs externas. Não as importe no servidor
    // durante a aprovação: aceite somente imagem validada ou URL já hospedada no Cloudinary.
    let approvedImage;
    try {
      approvedImage = await preparePendingBandImage(band.image);
    } catch (imageError) {
      if (imageError.code === "INVALID_BAND_IMAGE") {
        return res.status(400).json({ error: "A imagem desta inscrição é inválida ou externa. Atualize a imagem antes de aprovar." });
      }
      throw imageError;
    }

    // created_at = NOW() na aprovação para que a banda apareça como "nova" na Home.
    const inserted = await db.getOne(`INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW()) RETURNING id`,
      [band.name, band.genre, band.city, band.state, band.year, band.members, band.biography, band.contact, approvedImage, band.instagram, band.facebook, band.youtube, band.spotify, band.bandcamp, band.site]);
    await migrateLegacyBandImage({ id: inserted.id, image: approvedImage }, "bands");
    await db.run("DELETE FROM pending_bands WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao aprovar banda:", err.message);
    res.status(500).json({ error: "Não foi possível aprovar a banda" });
  }
});

app.delete("/api/pending-bands/:id", async (req, res) => {
  try {
    await db.run("DELETE FROM pending_bands WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

// Entrevistas
app.get("/api/interviews", async (req, res) => {
  const full = req.query.full === "1";
  const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit) || 0, 50)) : null;
  const fields = full ? "*" : "id, title, artist, image, date, created_at, LEFT(REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g'), 300) AS summary";
  const limitSql = limit ? `LIMIT ${limit}` : "";
  const interviews = await db.getAll(`SELECT ${fields} FROM interviews ORDER BY id DESC ${limitSql}`);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("CDN-Cache-Control", "no-store");
  res.set("Vercel-CDN-Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.json(interviews);
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

// Lançamentos
app.get("/api/releases", async (req, res) => {
  try {
    const full = req.query.full === "1";
    const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit) || 0, 50)) : null;
    const fields = full ? "*" : "id, title, artist, type, release_date, image, spotify, youtube, LEFT(COALESCE(description, ''), 300) AS description, created_at";
    const limitSql = limit ? `LIMIT ${limit}` : "";
    const releases = await db.getAll(`SELECT ${fields} FROM releases ORDER BY COALESCE(release_date, created_at::date::text) DESC, id DESC ${limitSql}`);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("CDN-Cache-Control", "no-store");
    res.set("Vercel-CDN-Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json(releases);
  } catch (err) { console.error("Erro ao buscar lançamentos:", err.message); res.status(500).json({ error: "Erro ao carregar lançamentos" }); }
});
app.post("/api/releases", async (req, res) => {
  const r = req.body;
  if (!r.title || !r.artist) return res.status(400).json({ error: "Título e artista/banda são obrigatórios" });
  await db.run("INSERT INTO releases (title, artist, type, release_date, image, spotify, youtube, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [r.title,r.artist,r.type||"Single",r.release_date||null,r.image||null,r.spotify||null,r.youtube||null,r.description||null]);
  res.json({ success:true });
});
app.put("/api/releases/:id", async (req, res) => {
  if (!/^[1-9]\d*$/.test(String(req.params.id))) return res.status(400).json({ error: "ID de lançamento inválido" });
  const r=req.body;
  if(!r.title||!r.artist) return res.status(400).json({error:"Título e artista/banda são obrigatórios"});
  await db.run("UPDATE releases SET title=$1, artist=$2, type=$3, release_date=$4, image=$5, spotify=$6, youtube=$7, description=$8 WHERE id=$9",[r.title,r.artist,r.type||"Single",r.release_date||null,r.image||null,r.spotify||null,r.youtube||null,r.description||null,req.params.id]);
  res.json({success:true});
});
app.delete("/api/releases/:id", async (req, res) => {
  if (!/^[1-9]\d*$/.test(String(req.params.id))) return res.status(400).json({ error: "ID de lançamento inválido" });
  try {
    const result = await db.query("DELETE FROM releases WHERE id = $1 RETURNING id", [req.params.id]);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("CDN-Cache-Control", "no-store");
    res.set("Vercel-CDN-Cache-Control", "no-store");
    if (result.rowCount === 0) return res.status(404).json({ error: "Lançamento não encontrado no banco de dados" });
    return res.status(200).json({ success: true, deletedId: result.rows[0].id });
  } catch (err) {
    console.error("Erro ao excluir lançamento:", err.message);
    return res.status(500).json({ error: "Erro ao excluir lançamento" });
  }
});

// Área do Fã: dados privados associados exclusivamente à sessão autenticada.
app.get("/api/fan/data", authenticate, async (req, res) => {
  try {
    const [favorites, watchlist] = await Promise.all([
      db.getAll(`SELECT b.id, b.name, b.genre, b.city, b.state, b.image, b.created_at, f.created_at AS favorited_at
        FROM fan_favorite_bands f JOIN bands b ON b.id = f.band_id
        WHERE f.user_id = $1 ORDER BY f.created_at DESC`, [req.authUser.id]),
      db.getAll(`SELECT e.id, e.title, e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.created_at, w.created_at AS saved_at
        FROM fan_event_watchlist w JOIN events e ON e.id = w.event_id
        WHERE w.user_id = $1 AND e.status = 'approved'
        ORDER BY e.date ASC NULLS LAST`, [req.authUser.id])
    ]);
    res.set("Cache-Control", "no-store");
    return res.json({ favorites, watchlist });
  } catch (err) {
    console.error("Erro ao carregar Área do Fã:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível carregar sua área." });
  }
});


// Resultados públicos: qualquer visitante pode conhecer as bandas e acompanhar a votação.
app.get("/api/votacao", async (req, res) => {
  try {
    const bands = await db.getAll(`SELECT b.id, b.name, b.image, COUNT(v.user_id)::int AS votes
      FROM bands b LEFT JOIN fan_weekly_votes v ON v.band_id = b.id AND v.week_start = date_trunc('week', CURRENT_DATE)::date
      GROUP BY b.id ORDER BY votes DESC, b.name ASC LIMIT 100`);
    const week = await db.getOne("SELECT date_trunc('week', CURRENT_DATE)::date AS week_start");
    res.set("Cache-Control", "no-store");
    return res.json({ week_start: week?.week_start || null, bands });
  } catch (err) {
    console.error("Erro ao carregar votação pública:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível carregar a votação agora." });
  }
});

app.get("/api/fan/vote", authenticate, async (req, res) => {
  try {
    const currentVote = await db.getOne("SELECT band_id, week_start FROM fan_weekly_votes WHERE user_id = $1 AND week_start = date_trunc('week', CURRENT_DATE)::date", [req.authUser.id]);
    const bands = await db.getAll(`SELECT b.id, b.name, b.image, COUNT(v.user_id)::int AS votes
      FROM bands b LEFT JOIN fan_weekly_votes v ON v.band_id = b.id AND v.week_start = date_trunc('week', CURRENT_DATE)::date
      GROUP BY b.id ORDER BY votes DESC, b.name ASC LIMIT 100`);
    const week = await db.getOne("SELECT date_trunc('week', CURRENT_DATE)::date AS week_start");
    res.set("Cache-Control", "no-store");
    return res.json({ week_start: week?.week_start || null, voted_band_id: currentVote ? Number(currentVote.band_id) : null, bands });
  } catch (err) {
    console.error("Erro ao carregar votação da semana:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível carregar a votação agora." });
  }
});
app.post("/api/fan/vote", authenticate, async (req, res) => {
  const bandId = Number(req.body?.band_id);
  if (!Number.isSafeInteger(bandId) || bandId <= 0) return res.status(400).json({ error: "Escolha uma banda válida." });
  try {
    const band = await db.getOne("SELECT id FROM bands WHERE id = $1", [bandId]);
    if (!band) return res.status(404).json({ error: "Banda não encontrada." });
    const inserted = await db.getOne("INSERT INTO fan_weekly_votes (user_id, week_start, band_id) VALUES ($1, date_trunc('week', CURRENT_DATE)::date, $2) ON CONFLICT (user_id, week_start) DO NOTHING RETURNING band_id", [req.authUser.id, bandId]);
    if (!inserted) return res.status(409).json({ error: "Você já votou nesta semana. A votação abre novamente na próxima segunda-feira." });
    return res.status(201).json({ success: true, band_id: Number(inserted.band_id) });
  } catch (err) {
    console.error("Erro ao registrar voto:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível registrar seu voto agora." });
  }
});
app.get("/api/fan/notifications", authenticate, async (req, res) => {
  try {
    const userId = req.authUser.id;
    // Uma notificação por fã e por semana, sem serviços externos nem tarefas agendadas.
    const currentWeek = await db.getOne("SELECT to_char(date_trunc('week', CURRENT_DATE), 'YYYY-MM-DD') AS week_start");
    if (currentWeek?.week_start) {
      await db.run(`INSERT INTO fan_notifications (user_id, type, title, message, link, source_key)
        SELECT DISTINCT f.user_id, 'vote', 'Nova votação da Banda da Semana',
          'A votação desta semana está aberta. Escolha sua banda favorita!',
          '/votacao', 'weekly-vote:' || $1::text
        FROM fan_favorite_bands f
        WHERE f.user_id = $2
        ON CONFLICT (user_id, source_key) DO NOTHING`, [currentWeek.week_start, userId]);
    }

    // Lembretes somente para shows salvos, aprovados e com data ISO válida hoje ou amanhã.
    const upcomingEvents = await db.getAll(`SELECT e.id, e.title, e.artist, e.date, (e.date::date - CURRENT_DATE)::int AS days_until
      FROM fan_event_watchlist w
      JOIN events e ON e.id = w.event_id
      WHERE w.user_id = $1
        AND e.status = 'approved'
        AND e.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND e.date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
      ORDER BY e.date ASC`, [userId]);
    for (const event of upcomingEvents) {
      const daysUntil = Number(event.days_until || 0);
      const eventName = String(event.title || event.artist || "Seu show salvo").trim();
      const timing = daysUntil <= 0 ? "acontece hoje" : "acontece amanhã";
      await db.run(`INSERT INTO fan_notifications (user_id, type, title, message, link, source_key)
        VALUES ($1, 'event', $2, $3, $4, $5)
        ON CONFLICT (user_id, source_key) DO NOTHING`,
        [userId, `Lembrete de show: ${eventName}`, `${eventName} ${timing}. Confira os detalhes do evento.`, `/eventos/${event.id}`, `event-reminder:${event.id}:${event.date}`]);
    }

    const notifications = await db.getAll("SELECT id, type, title, message, link, is_read, created_at FROM fan_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30", [userId]);
    res.set("Cache-Control", "no-store");
    return res.json(notifications);
  } catch (err) {
    console.error("Erro ao carregar notificações do fã:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível carregar suas notificações." });
  }
});
app.post("/api/fan/notifications/:id/read", authenticate, async (req, res) => {
  if (!/^[1-9]\d*$/.test(String(req.params.id))) return res.status(400).json({ error: "Notificação inválida." });
  try {
    await db.run("UPDATE fan_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2", [req.params.id, req.authUser.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao marcar notificação:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível atualizar a notificação." });
  }
});

app.post("/api/fan/favorites", authenticate, async (req, res) => {
  const bandId = Number(req.body?.band_id);
  if (!Number.isSafeInteger(bandId) || bandId <= 0) return res.status(400).json({ error: "Banda inválida." });
  try {
    const band = await db.getOne("SELECT id FROM bands WHERE id = $1", [bandId]);
    if (!band) return res.status(404).json({ error: "Banda não encontrada." });
    await db.run("INSERT INTO fan_favorite_bands (user_id, band_id) VALUES ($1, $2) ON CONFLICT (user_id, band_id) DO NOTHING", [req.authUser.id, bandId]);
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("Erro ao favoritar banda:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível favoritar esta banda." });
  }
});

app.delete("/api/fan/favorites/:id", authenticate, async (req, res) => {
  const bandId = Number(req.params.id);
  if (!Number.isSafeInteger(bandId) || bandId <= 0) return res.status(400).json({ error: "Banda inválida." });
  try {
    await db.run("DELETE FROM fan_favorite_bands WHERE user_id = $1 AND band_id = $2", [req.authUser.id, bandId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover banda favorita:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível remover esta banda." });
  }
});

app.post("/api/fan/events", authenticate, async (req, res) => {
  const eventId = Number(req.body?.event_id);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return res.status(400).json({ error: "Evento inválido." });
  try {
    const event = await db.getOne("SELECT id FROM events WHERE id = $1 AND status = 'approved'", [eventId]);
    if (!event) return res.status(404).json({ error: "Evento não encontrado ou ainda não publicado." });
    await db.run("INSERT INTO fan_event_watchlist (user_id, event_id) VALUES ($1, $2) ON CONFLICT (user_id, event_id) DO NOTHING", [req.authUser.id, eventId]);
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("Erro ao salvar evento:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível salvar este evento." });
  }
});

app.delete("/api/fan/events/:id", authenticate, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) return res.status(400).json({ error: "Evento inválido." });
  try {
    await db.run("DELETE FROM fan_event_watchlist WHERE user_id = $1 AND event_id = $2", [req.authUser.id, eventId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("Erro ao remover evento salvo:", err.code || "DB_ERROR");
    return res.status(500).json({ error: "Não foi possível remover este evento." });
  }
});

// Eventos
app.get("/api/events", async (req, res) => {
  const full = req.query.full === "1";
  const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit) || 0, 100)) : null;
  const fields = full ? "*" : "id, title, artist, date, time, location, city, state, image, ticket_link, ticket_location, LEFT(COALESCE(description, ''), 300) AS description, created_at";
  const limitSql = limit ? `LIMIT ${limit}` : "";
  const events = await db.getAll(`SELECT ${fields} FROM events ${full ? "" : "WHERE status = 'approved'"} ORDER BY date ASC ${limitSql}`);
  const mkSlug = (t) => t ? t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").substring(0,80) : "";
  res.set("Cache-Control", full ? "no-store" : "public, s-maxage=300, stale-while-revalidate=900");
  res.json(events.map(e => ({ ...e, slug: mkSlug(e.title) })));
});

app.post("/api/event-submissions", async (req, res) => {
  try {
    const e = req.body || {};
    const artist = String(e.artist || "").trim();
    const title = String(e.title || "").trim() || artist.split(/\r?\n/).map(name => name.trim()).filter(Boolean).join(" + ") || "Evento sem título";
    const date = String(e.date || "").trim();
    const contactEmail = String(e.contact_email || "").trim();
    if (!artist || !date || !contactEmail) {
      return res.status(400).json({ error: "Preencha a banda/artista, data e e-mail de contato." });
    }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail)) {
      return res.status(400).json({ error: "Informe um e-mail de contato válido." });
    }
    const insertedEvent = await db.getOne(
      "INSERT INTO events (title, artist, date, time, location, city, state, image, ticket_link, ticket_location, description, contact_email, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING id",
      [title, artist, date, e.time || null, String(e.location || "").trim(), String(e.city || "").trim(), String(e.state || "").trim(), String(e.image || "").trim(), String(e.ticket_link || "").trim(), String(e.ticket_location || "").trim(), String(e.description || "").trim(), contactEmail]
    );
    await notifyAdminByEmail("Novo evento aguardando aprovação", {
      "Evento": title, "Banda / artista": artist, "Data": date, "Horário": e.time,
      "Local": e.location, "Cidade": [e.city, e.state].filter(Boolean).join(" / "),
      "E-mail de contato": contactEmail, "Link de ingressos": e.ticket_link, "Ponto físico de venda": e.ticket_location,
      "ID da inscrição": insertedEvent.id
    });
    res.status(201).json({ success: true, message: "Evento enviado para análise da administração." });
  } catch (err) {
    console.error("Erro ao receber evento:", err);
    res.status(500).json({ error: "Não foi possível enviar o evento agora. Tente novamente." });
  }
});

app.post("/api/events", async (req, res) => {
  const e = req.body;
  if ((!String(e.title || "").trim() && !String(e.artist || "").trim()) || !e.date) return res.status(400).json({ error: "Informe o título ou pelo menos uma banda, além da data" });
  const insertedEvent = await db.getOne("INSERT INTO events (title, artist, date, time, location, city, state, image, ticket_link, ticket_location, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    [String(e.title || "").trim() || String(e.artist || "").split(/\r?\n/).map(name => name.trim()).filter(Boolean).join(" + "), e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.ticket_location, e.description]);
  await notifyAdminByEmail("Novo evento cadastrado no site", {
    "Evento": e.title, "Banda / artista": e.artist, "Data": e.date, "Horário": e.time,
    "Local": e.location, "Cidade": [e.city, e.state].filter(Boolean).join(" / "),
    "ID do evento": insertedEvent.id
  });
  res.json({ success: true });
});

app.put("/api/events/:id", async (req, res) => {
  const e = req.body;
  if ((!String(e.title || "").trim() && !String(e.artist || "").trim()) || !e.date) return res.status(400).json({ error: "Informe o título ou pelo menos uma banda, além da data" });
  await db.run("UPDATE events SET title=$1, artist=$2, date=$3, time=$4, location=$5, city=$6, state=$7, image=$8, ticket_link=$9, ticket_location=$10, description=$11 WHERE id=$12",
    [String(e.title || "").trim() || String(e.artist || "").split(/\r?\n/).map(name => name.trim()).filter(Boolean).join(" + "), e.artist, e.date, e.time, e.location, e.city, e.state, e.image, e.ticket_link, e.ticket_location, e.description, req.params.id]);
  res.json({ success: true });
});

app.put("/api/events/:id/status", async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["approved", "pending"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  try {
    await db.run("UPDATE events SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível atualizar o status do evento." });
  }
});

app.delete("/api/events/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM events WHERE id = $1 RETURNING id", [req.params.id]);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("CDN-Cache-Control", "no-store");
    res.set("Vercel-CDN-Cache-Control", "no-store");
    if (result.rowCount === 0) return res.status(404).json({ error: "Evento não encontrado." });
    return res.status(200).json({ success: true, deletedId: result.rows[0].id });
  } catch (err) {
    console.error("Erro ao excluir evento:", err.message);
    return res.status(500).json({ error: "Não foi possível excluir o evento." });
  }
});

// Comentários
app.get("/api/comments/:pageType/:pageId", async (req, res) => {
  try {
    const { pageType, pageId } = req.params;
    const comments = await db.getAll(
      "SELECT * FROM comments WHERE page_type = $1 AND page_id = $2 ORDER BY created_at DESC",
      [pageType, parseInt(pageId)]
    );
    res.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/comments", async (req, res) => {
  try {
    const { page_type, page_id, content } = req.body;
    if (!page_type || !/^\d+$/.test(String(page_id || "")) || !content) {
      return res.status(400).json({ error: "Campos obrigatórios: page_type, page_id e content" });
    }
    if (content.trim().length < 2) return res.status(400).json({ error: "Comentário muito curto" });
    if (content.length > 1000) return res.status(400).json({ error: "Comentário muito longo (máx 1000 caracteres)" });
    const result = await pool.query(
      "INSERT INTO comments (page_type, page_id, user_id, user_name, user_avatar, content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [String(page_type).slice(0, 40), parseInt(page_id, 10), req.authUser.id, req.authUser.display_name || req.authUser.username, req.authUser.avatar || null, content.trim()]
    );
    res.json({ success: true, comment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    const comment = await db.getOne("SELECT user_id FROM comments WHERE id = $1", [req.params.id]);
    if (!comment) return res.status(404).json({ error: "Comentário não encontrado" });
    if (Number(comment.user_id) !== Number(req.authUser.id) && !["admin", "editor"].includes(req.authUser.role)) {
      return res.status(403).json({ error: "Você só pode excluir seu próprio comentário" });
    }
    await db.run("DELETE FROM comments WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível excluir o comentário" });
  }
});

// Feeds RSS
app.get("/api/rss-feeds", (req, res) => {
  res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  res.json(rssFeeds);
});

app.get("/api/rss-status", async (req, res) => {
  try {
    const rows = await db.getAll("SELECT * FROM rss_feed_status ORDER BY checked_at DESC NULLS LAST, feed_name ASC");
    res.set("Cache-Control", "no-store");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

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
      let feedImported = 0;
      let feedItems = 0;
      try {
        const items = await getFeedItems(feed.url);
        feedItems = items.length;
        for (const itemXml of items.slice(0, 3)) {
          const title = decodeHtmlEntities(itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim());
          const content = decodeHtmlEntities(extractContentFromItem(itemXml));
          const rssImage = extractImageFromItem(itemXml, content);
          const link = extractLinkFromItem(itemXml);
          const articleImage = await extractImageFromArticlePage(link);
          const image = articleImage || rssImage;
          if (!title || !image) continue;
          if (!(await isValidImage(image))) continue;
          if (!(await postAlreadyExists(title, link))) {
            const newPost = await db.getOne("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5) RETURNING id", [title, content, image, link, feed.name]);
            await createFanNotificationsForPost(newPost.id, title, content, link);
            imported++;
            feedImported++;
          }
        }
        await saveRssFeedStatus(feed, { status: feedImported > 0 ? "updated" : "no_new", message: feedImported > 0 ? `${feedImported} notícia(s) nova(s) importada(s).` : "Nenhuma notícia nova com imagem válida entre os 3 primeiros itens do feed.", imported: feedImported, items: feedItems });
      } catch (e) {
        console.warn(`Erro no feed ${feed.name}: ${e.message}`);
        await saveRssFeedStatus(feed, { status: "error", message: e.message, imported: feedImported, items: feedItems });
      }
    }
    // Limpar posts sem imagem após import manual
    await pool.query("DELETE FROM posts WHERE image IS NULL OR image = '' OR image NOT LIKE 'http%'").catch(() => {});
    await cleanupRssPostsPerSource();
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/import-rss-single", async (req, res) => {
  let feedForStatus = null;
  try {
    const { feed } = req.body;
    feedForStatus = feed;
    if (!feed || !feed.url) return res.status(400).json({ error: "Feed inválido" });
    let imported = 0;
    const items = await getFeedItems(feed.url);
    for (const itemXml of items.slice(0, 3)) {
      const title = decodeHtmlEntities(itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim());
      const content = decodeHtmlEntities(extractContentFromItem(itemXml));
      const rssImage = extractImageFromItem(itemXml, content);
      const link = extractLinkFromItem(itemXml);
      const articleImage = await extractImageFromArticlePage(link);
      const image = articleImage || rssImage;
      if (!title || !image) continue;
      if (!(await isValidImage(image))) continue;
      if (!(await postAlreadyExists(title, link))) {
        const newPost = await db.getOne("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5) RETURNING id", [title, content, image, link, feed.name]);
            await createFanNotificationsForPost(newPost.id, title, content, link);
        imported++;
      }
    }
    await pool.query("DELETE FROM posts WHERE image IS NULL OR image = '' OR image NOT LIKE 'http%'").catch(() => {});
    await cleanupRssPostsPerSource();
    await saveRssFeedStatus(feed, { status: imported > 0 ? "updated" : "no_new", message: imported > 0 ? `${imported} notícia(s) nova(s) importada(s).` : "Nenhuma notícia nova com imagem válida entre os 3 primeiros itens do feed.", imported, items: items.length });
    res.json({ success: true, imported });
  } catch (err) {
    if (feedForStatus) await saveRssFeedStatus(feedForStatus, { status: "error", message: err.message });
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/reimport-rss", async (req, res) => {
  try {
    let updated = 0;
    let created = 0;
    const feeds = req.body.feeds || rssFeeds;
    for (const feed of feeds) {
      let feedUpdated = 0;
      let feedCreated = 0;
      let feedItems = 0;
      try {
        const response = await fetchFunc(feed.url, { headers: BROWSER_HEADERS });
        if (!response.ok) throw new Error("HTTP " + response.status + " ao acessar o feed");
        const xml = await response.text();
        const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
        feedItems = items.length;
        for (const itemXml of items.slice(0, 3)) {
          const title = decodeHtmlEntities(itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim());
          const content = decodeHtmlEntities(extractContentFromItem(itemXml));
          const image = extractImageFromItem(itemXml, content);
          const link = extractLinkFromItem(itemXml);
          if (!title || !image) continue;
          if (!(await isValidImage(image))) continue;
          const existing = await db.getOne("SELECT id, image FROM posts WHERE title = $1", [title]);
          if (existing) {
            // Reimportação também atualiza o conteúdo para o resumo seguro
            // gerado por extractContentFromItem(), evitando manter cópias
            // integrais de matérias importadas anteriormente.
            await db.run(
              "UPDATE posts SET content = $1, link = $2, source = $3, image = $4 WHERE id = $5",
              [content, link, feed.name, image, existing.id]
            );
            updated++;
            feedUpdated++;
          } else {
            const newPost = await db.getOne("INSERT INTO posts (title, content, image, link, source) VALUES ($1, $2, $3, $4, $5) RETURNING id", [title, content, image, link, feed.name]);
            await createFanNotificationsForPost(newPost.id, title, content, link);
            created++;
            feedCreated++;
          }
        }
        await saveRssFeedStatus(feed, { status: feedCreated > 0 ? "updated" : "no_new", message: feedCreated > 0 ? `${feedCreated} notícia(s) nova(s) criada(s); ${feedUpdated} atualizada(s).` : `Nenhuma notícia nova criada; ${feedUpdated} notícia(s) existente(s) atualizada(s).`, imported: feedCreated, updated: feedUpdated, items: feedItems });
      } catch (e) {
        console.warn(`Erro no feed ${feed.name}: ${e.message}`);
        await saveRssFeedStatus(feed, { status: "error", message: e.message, imported: feedCreated, updated: feedUpdated, items: feedItems });
      }
    }
    await cleanupRssPostsPerSource();
    res.json({ success: true, updated, created });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/fix-html-entities", async (req, res) => {
  try {
    const allPosts = await db.getAll("SELECT id, title, content FROM posts");
    let fixed = 0;
    for (const p of allPosts) {
      const cleanTitle = decodeHtmlEntities(p.title);
      const cleanContent = decodeHtmlEntities(p.content);
      if (cleanTitle !== p.title || cleanContent !== p.content) {
        await db.run("UPDATE posts SET title = $1, content = $2 WHERE id = $3", [cleanTitle, cleanContent, p.id]);
        fixed++;
      }
    }
    res.json({ success: true, fixed, total: allPosts.length, message: `${fixed} posts corrigidos de ${allPosts.length} total` });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
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
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

app.post("/api/test-rss-images", async (req, res) => {
  try {
    const { feedUrl } = req.body;
    if (!feedUrl) return res.status(400).json({ error: "URL do feed é obrigatória" });
    const response = await fetchFunc(feedUrl, { headers: BROWSER_HEADERS });
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
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});



// Endpoint manual de limpeza de duplicatas
app.post("/api/cleanup-duplicates", async (req, res) => {
  try {
    const result = await cleanupDuplicatePosts();
    res.json({ success: true, ...result, message: `${result.total} duplicatas removidas` });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});
// --- OPEN GRAPH HELPERS ---
function buildOgHtml(title, description, image, ogUrl, type, siteUrl) {
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
<body>
<h1>${title}</h1><p>${description}</p><img src="${safeImg}" alt="${title}" width="1200" height="630" />
<script>if(!/bot|crawl|spider|facebook|twitter|whatsapp|telegram|linkedin|slack/i.test(navigator.userAgent)){window.location.replace("${siteUrl || ogUrl}")}</script>
</body>
</html>`;
}
function resolveImage(img) {
  const fallback = "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=1200&h=630&fit=crop";
  if (!img) return fallback;
  if (img.includes("fbcdn.net") || img.includes("facebook.com") || img.includes("scontent")) return fallback;
  if (img.startsWith("http")) return img;
  const publicApiUrl = (process.env.PUBLIC_API_URL || "").replace(/\/$/, "");
  return publicApiUrl ? publicApiUrl + img : img;
}
function isCrawler(ua) {
  const l = (ua || "").toLowerCase();
  return l.includes("facebookexternalhit") || l.includes("twitterbot") || l.includes("whatsapp") || l.includes("telegrambot") || l.includes("linkedinbot") || l.includes("slackbot") || l.includes("bot") || l.includes("crawl") || l.includes("spider");
}
function sendOg(res, title, description, image, ogUrl, type, siteUrl, ua) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.status(200).send(buildOgHtml(title, description, image, ogUrl, type, siteUrl));
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

// Deletar todas as notícias sem imagem
app.delete("/api/posts-without-images", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM posts WHERE image IS NULL OR image = '' RETURNING id");
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

// Debug RSS feed - ver o que está vindo
app.get("/api/debug-rss", async (req, res) => {
  try {
    const feedUrl = req.query.url || "https://tenhomaisdiscosqueamigos.com/feed/";
    const response = await fetchFunc(feedUrl, { headers: BROWSER_HEADERS });
    const xml = await response.text();
    const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
    const statusCode = response.status;
    const contentType = response.headers.get("content-type");
    const xmlPreview = xml.substring(0, 1000);
    const hasItems = xml.includes("<item");
    const hasEntry = xml.includes("<entry");
    const results = items.slice(0, 3).map(itemXml => {
      const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      const rawHtml = extractRawContent(itemXml);
      const image = extractImageFromItem(itemXml, null);
      const hasImg = rawHtml.includes("<img");
      const imgTags = rawHtml.match(/<img[^>]*>/gi) || [];
      return { title: title?.substring(0, 60), image, hasImg, imgTags: imgTags.map(t => t.substring(0, 200)), rawHtmlLength: rawHtml.length, rawHtmlPreview: rawHtml.substring(0, 500) };
    });
    res.json({ feedUrl, statusCode, contentType, hasItems, hasEntry, totalItems: items.length, xmlPreview, results });
  } catch (err) {
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

// Sitemap dinâmico: inclui páginas públicas e conteúdos publicados do banco.
app.get("/sitemap.xml", async (req, res) => {
  try {
    await ensureInitialized();
    const base = "https://comunidadedorock.com.br";
    const [posts, bands, interviews, events] = await Promise.all([
      db.getAll("SELECT id, created_at FROM posts ORDER BY created_at DESC"),
      db.getAll("SELECT id, created_at FROM bands ORDER BY created_at DESC"),
      db.getAll("SELECT id, created_at FROM interviews ORDER BY created_at DESC"),
      db.getAll("SELECT id, created_at FROM events WHERE status = 'approved' ORDER BY created_at DESC")
    ]);
    const staticPaths = ["/", "/noticias", "/bandas", "/entrevistas", "/eventos", "/guias/divulgacao-banda-independente", "/cadastrar-banda", "/sobre", "/privacidade", "/termos", "/contato"];
    const urls = staticPaths.map((path) => ({ loc: base + path }));
    for (const post of posts) urls.push({ loc: base + "/noticias/" + post.id, lastmod: post.created_at });
    for (const band of bands) urls.push({ loc: base + "/bandas/" + band.id, lastmod: band.created_at });
    for (const interview of interviews) urls.push({ loc: base + "/entrevistas/" + interview.id, lastmod: interview.created_at });
    for (const event of events) urls.push({ loc: base + "/eventos/" + event.id, lastmod: event.created_at });
    const escapeXml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\'/g, "&apos;");
    const entries = urls.map(({ loc, lastmod }) => "  <url><loc>" + escapeXml(loc) + "</loc>" + (lastmod ? "<lastmod>" + new Date(lastmod).toISOString().slice(0, 10) + "</lastmod>" : "") + "</url>").join("\n");
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + "\n</urlset>");
  } catch (err) {
    console.error("Erro ao gerar sitemap:", err);
    res.status(500).type("text/plain").send("Não foi possível gerar o sitemap.");
  }
});
// Inicialização compatível com Vercel e desenvolvimento local.
// Em produção serverless, o banco é inicializado sob demanda pelo middleware acima.
app.get("/api/cron/rss", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    await autoImportRss();
    res.json({ success: true, message: "Importação RSS concluída" });
  } catch (err) {
    console.error("Erro no cron RSS:", err);
    res.status(500).json({ error: "Não foi possível concluir a solicitação" });
  }
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  ensureInitialized()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀 Server ON: http://localhost:${PORT}`));
    })
    .catch(err => {
      console.error("❌ Erro ao iniciar servidor:", err);
      process.exit(1);
    });
}
