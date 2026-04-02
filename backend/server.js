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
    throw new Error("fetch is not available in this environment. Instale node-fetch ou use Node >= 18.");
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir imagens locais como arquivos estáticos COM CORS explícito
app.use('/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cache-Control', 'public, max-age=31536000');
  next();
}, express.static(imagesDir));

// FEEDS RSS PADRÃO (será carregado do banco de dados na inicialização)

// BANCO SQLITE
const db = new Database("./database.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    image TEXT,
    link TEXT,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS bands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    genre TEXT,
    city TEXT,
    state TEXT,
    year TEXT,
    members TEXT,
    biography TEXT,
    contact TEXT,
    image TEXT,
    instagram TEXT,
    facebook TEXT,
    youtube TEXT,
    spotify TEXT,
    bandcamp TEXT,
    site TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS pending_bands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    genre TEXT,
    city TEXT,
    state TEXT,
    year TEXT,
    members TEXT,
    biography TEXT,
    contact TEXT,
    image TEXT,
    instagram TEXT,
    facebook TEXT,
    youtube TEXT,
    spotify TEXT,
    bandcamp TEXT,
    site TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS rss_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    logo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    date TEXT,
    time TEXT,
    location TEXT,
    city TEXT,
    state TEXT,
    image TEXT,
    ticket_link TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    content TEXT,
    image TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Carregar feeds RSS do banco de dados
let rssFeeds = [];
try {
  const rows = db
    .prepare("SELECT id, name, url, logo FROM rss_feeds")
    .all();

  // usa rows normalmente aqui
  console.log(rows);

} catch (err) {
  console.error("Erro:", err.message);
}  if (rows && rows.length > 0) {
    rssFeeds = rows;
  } else {
    // Se não houver feeds no banco, usar os padrão (SEM LOGOS - usará favicon como fallback)
    rssFeeds = [
      { 
        name: "Rolling Stone Brasil", 
        url: "https://rollingstone.com.br/feed/",
        logo: null
      },
      { 
        name: "Rock in Rio News",
        url: "https://www.rockinrio.com/pt-br/feed/",
        logo: null
      }
    ];
    // E salvar na tabela
    rssFeeds.forEach(feed => {
      db.run("INSERT INTO rss_feeds (name, url, logo) VALUES (?, ?, ?)", [feed.name, feed.url, feed.logo]);
    });
  }
  console.log("✅ Feeds RSS carregados do banco de dados");


// LOGIN ADMIN
const admin = {
  user: "admin",
  pass: "1234"
};

// Função auxiliar para sanitizar URLs de imagens
function sanitizeImageUrl(url) {
  if (!url) return "";
  
  // Rejeitar URLs de embeds do YouTube - não são imagens
  if (url.includes("youtube.com/embed")) {
    return "";
  }
  
  // Se não tem protocolo, não é válida
  if (!url.startsWith("http")) {
    return "";
  }
  
  // Remover domínio duplicado tipo 1: https://domain.com/domain.com/path
  const domainDuplicatePattern1 = /^(https?:\/\/[^\/]+)\/(www\.[^\s\/]+\.com)\/(.+)$/i;
  const match1 = url.match(domainDuplicatePattern1);
  if (match1) {
    const baseUrl = match1[1];
    const path = match1[3];
    url = `${baseUrl}/${path}`;
  }
  
  // Remover domínio duplicado tipo 2: https://domain.com/uploads.domain.com/ ou similar
  // Ex: https://www.tenhomaisdiscosqueamigos.com/uploads.tenhomaisdiscosqueamigos.com/2026/03/file.jpg
  // Deve virar: https://www.tenhomaisdiscosqueamigos.com/uploads/2026/03/file.jpg
  const domainPat2 = /^(https?:\/\/[^\/]+)\/uploads\.([^\/]+\.com)\/(.+)$/i;
  const match2 = url.match(domainPat2);
  if (match2) {
    const baseUrl = match2[1];
    const path = match2[3];
    url = `${baseUrl}/uploads/${path}`;
  }
  
  return url.trim();
}

// Função auxiliar para extrair imagens do item (MELHORADA)
function extractImageFromItem(item, content) {
  let image = "";
  
  // 1. Tentar extrair de <media:content> (último atributo, geralmente é imagem)
  const mediaMatches = item.match(/<media:content[^>]*url=["']([^"']+)["']/gi);
  if (mediaMatches && mediaMatches.length > 0) {
    const lastMediaMatch = mediaMatches[mediaMatches.length - 1].match(/<media:content[^>]*url=["']([^"']+)["']/i);
    if (lastMediaMatch) image = lastMediaMatch[1];
  }
  
  // 2. Tentar extrair de <media:thumbnail>
  if (!image) {
    const thumbMatch = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
    if (thumbMatch) image = thumbMatch[1];
  }
  
  // 3. Tentar extrair de <image> tag
  if (!image) {
    const imageMatch = item.match(/<image>([\s\S]*?)<\/image>/i);
    if (imageMatch) {
      const urlMatch = imageMatch[1].match(/<url>([\s\S]*?)<\/url>/i);
      if (urlMatch) image = urlMatch[1].trim();
    }
  }
  
  // 4. Tentar extrair de <enclosure> (podcasts/imagens)
  if (!image) {
    const enclosureMatch = item.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
    if (enclosureMatch) {
      const url = enclosureMatch[1];
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
      if (imageExtensions.test(url)) {
        image = url;
      }
    }
  }
  
  // 5. Tentar extrair de content:encoded com img tags
  if (!image) {
    const imgMatch = item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
    if (imgMatch) {
      const contentPart = imgMatch[1];
      const srcMatch = contentPart.match(/<img[^>]*src=["']([^"']+)["']/i);
      if (srcMatch) image = srcMatch[1];
    }
  }
  
  // 6. Tentar extrair de meta:image ou og:image
  if (!image) {
    const ogMatch = item.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch) image = ogMatch[1];
  }
  
  // 7. Tentar extrair de <img> na descrição
  if (!image && content) {
    const descImgMatch = content.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (descImgMatch) image = descImgMatch[1];
  }
  
  // 8. Extrair primeira imagem de <img> com validação
  if (!image) {
    const imgRegex = /<img[^>]*src=["']?([^\s"'>]+)["']?[^>]*>/gi;
    const imgMatches = item.match(imgRegex);
    if (imgMatches && imgMatches.length > 0) {
      for (let i = imgMatches.length - 1; i >= 0; i--) {
        const srcMatch = imgMatches[i].match(/src=["']?([^\s"'>]+)/i);
        if (srcMatch) {
          const url = srcMatch[1];
          // Validar que é uma URL válida que começa com http
          if (url.startsWith('http')) {
            image = url;
            break;
          }
        }
      }
    }
  }
  
  // 9. Limpar espaços
  image = image.trim();
  
  // 10. Sanitizar URL para remover domínios duplicados
  image = sanitizeImageUrl(image);
  
  // 11. VALIDAÇÃO FINAL: Imagem deve começar com http e não ser vazia
  if (!image || !image.startsWith('http')) {
    return null; // Retorna null se imagem for inválida
  }
  
  return image;
}

// Função auxiliar para extrair conteúdo/descrição do item
function extractContentFromItem(item) {
  let content = "";
  
  // 1. Tentar extrair de <content:encoded> PRIMEIRO (geralmente tem conteúdo maior)
  const contentEncodedMatch = item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
  if (contentEncodedMatch) {
    content = contentEncodedMatch[1];
  }
  
  // 2. Se não encontrou, tentar <description>
  if (!content || content.length < 20) {
    const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch && descMatch[1].length > content.length) {
      content = descMatch[1];
    }
  }
  
  // 3. Se não encontrou, tentar <summary>
  if (!content || content.length < 20) {
    const summaryMatch = item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (summaryMatch && summaryMatch[1].length > content.length) {
      content = summaryMatch[1];
    }
  }
  
  // 4. Se não encontrou, tentar <content>
  if (!content || content.length < 20) {
    const contentTagMatch = item.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
    if (contentTagMatch && contentTagMatch[1].length > content.length) {
      content = contentTagMatch[1];
    }
  }
  
  // 5. Se não encontrou, extrair primeiro parágrafo de <p>
  if (!content || content.length < 20) {
    const pMatch = item.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch && pMatch[1].length > content.length) {
      content = pMatch[1];
    }
  }
  
  // 6. Remover CDATA
  content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  
  // 7. Remover scripts e styles
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // 8. Limpar HTML tags, mas manter estrutura
  content = content.replace(/<br\s*\/?>/gi, "\n");
  content = content.replace(/<\/p>/gi, "\n");
  content = content.replace(/<[^>]+>/g, "");
  
  // 9. Decodificar entidades HTML
  content = content
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  // 10. Remover quebras de linha múltiplas
  content = content.replace(/\n+/g, " ");
  
  // 11. Remover espaços extras
  content = content.replace(/\s+/g, " ").trim();
  
  // 12. Garantir mínimo de conteúdo
  if (!content || content.length < 10) {
    return null; // Retorna null se conteúdo for muito pequeno
  }
  
  return content;
}

// Função auxiliar para extrair link do item
function extractLinkFromItem(item) {
  let link = "";
  
  // 1. Tentar extrair de <link>
  const linkMatch = item.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (linkMatch) link = linkMatch[1].trim();
  
  // 2. Tentar extrair de <link href="">
  if (!link) {
    const linkHrefMatch = item.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (linkHrefMatch) link = linkHrefMatch[1];
  }
  
  // 3. Tentar extrair de <url>
  if (!link) {
    const urlMatch = item.match(/<url>([^<]+)<\/url>/i);
    if (urlMatch) link = urlMatch[1].trim();
  }
  
  // 4. Tentar extrair de <id> (em feeds Atom)
  if (!link) {
    const idMatch = item.match(/<id>([^<]+)<\/id>/i);
    if (idMatch) link = idMatch[1].trim();
  }
  
  return link;
}

// Função auxiliar para extrair data do item RSS
function extractDateFromItem(item) {
  let date = null;
  
  // 1. Tentar extrair de <pubDate> (RSS)
  const pubDateMatch = item.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
  if (pubDateMatch) {
    date = new Date(pubDateMatch[1].trim());
  }
  
  // 2. Se não encontrou, tentar <published> (Atom)
  if (!date || isNaN(date.getTime())) {
    const publishedMatch = item.match(/<published[^>]*>([^<]+)<\/published>/i);
    if (publishedMatch) {
      date = new Date(publishedMatch[1].trim());
    }
  }
  
  // 3. Se não encontrou, tentar <updated> (Atom)
  if (!date || isNaN(date.getTime())) {
    const updatedMatch = item.match(/<updated[^>]*>([^<]+)<\/updated>/i);
    if (updatedMatch) {
      date = new Date(updatedMatch[1].trim());
    }
  }
  
  // 4. Se não encontrou, tentar <dc:date>
  if (!date || isNaN(date.getTime())) {
    const dcDateMatch = item.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
    if (dcDateMatch) {
      date = new Date(dcDateMatch[1].trim());
    }
  }
  
  // Se conseguiu uma data válida, retornar em ISO format
  if (date && !isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Se não conseguiu, retorna data atual
  return new Date().toISOString();
}

// FUNÇÃO AUXILIAR PARA IMPORTAR RSS AUTOMATICAMENTE
async function autoImportRss() {
  try {
    for (const feed of rssFeeds) {
      if (!feed.url) continue;
      
      try {
        const response = await fetchFunc(feed.url);
        if (!response.ok) {
          console.warn(`⚠️ RSS Feed ${feed.name}: HTTP ${response.status}`);
          continue;
        }
        
        let xml;
        try {
          xml = await response.text();
        } catch (parseErr) {
          console.warn(`⚠️ Erro ao ler resposta do feed ${feed.name}:`, parseErr.message);
          continue;
        }

        const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
        let importedOne = false;

        for (let i = 0; i < items.length; i++) {
          if (importedOne) break;

          try {
            const item = items[i];
            if (!item) continue;

            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
            let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
            let content = extractContentFromItem(item);
            let image = extractImageFromItem(item, content);

            // VALIDAÇÃO: Não importar posts sem título, conteúdo ou imagem válida
            if (!title || !content || !image) {
              if (!image) {
                console.warn(`⚠️ Feed "${feed.name}" - Ignorando: SEM IMAGEM - "${title?.substring(0, 40)}..."`);
              }
              continue;
            }

            let link = extractLinkFromItem(item);
            let source = feed.name || "Desconhecida";
            
            let createdAt;
            try {
              createdAt = extractDateFromItem(item);
            } catch (dateErr) {
              console.warn(`⚠️ Erro ao extrair data do item "${title}":`, dateErr.message);
              createdAt = new Date().toISOString();
            }

            // Verificar se já existe
            await new Promise((resolve) => {
              try {
  const row = db
    .prepare("SELECT id FROM posts WHERE title = ?")
    .get(title);

  if (row) {
    return resolve();
  }

} catch (err) {
  console.warn(`⚠️ Erro ao verificar item "${title}":`, err.message);
  return resolve();
}
                
                  // VALIDAÇÃO FINAL ANTES DE INSERIR
                  // Não insere se imagem for inválida
                  if (!image || !image.startsWith('http')) {
                    console.warn(`⚠️ Post rejeitado - imagem inválida: "${title.substring(0, 40)}..."`);
                    return resolve();
                  }
                  
                  // DOWNLOAD DA IMAGEM
                  downloadImage(image).then(localImageUrl => {
                    const finalImageUrl = localImageUrl || image; // Usa local ou URL original
                    
                    // Se não existe, insere
                    db.run(
                      "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                      [title, content, finalImageUrl, link, source],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ Erro ao inserir item "${title}":`, err.message);
                        } else {
                          console.log(`✅ Post importado: "${title.substring(0, 50)}..."`);
                          importedOne = true;
                        }
                        resolve();
                      }
                    );
                  }).catch(() => {
                    // Se falhar o download, tenta inserir com URL original
                    db.run(
                      "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                      [title, content, image, link, source],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ Erro ao inserir item "${title}":`, err.message);
                        } else {
                          importedOne = true;
                        }
                        resolve();
                      }
                    );
                  });
                
              
            } catch (itemErr) {
              console.warn(`⚠️ Erro ao processar item ${i + 1} do feed ${feed.name}:`, itemErr.message);
              continue;
            }
          }
      } catch (feedErr) {
        console.warn(`⚠️ Erro ao processar feed ${feed.name}:`, feedErr.message);
        continue;
      }
    }
  } catch (err) {
    console.error("❌ Erro na atualização automática de RSS:", err.message);
  }
}

// Iniciar auto-atualização de RSS a cada 5 segundos (1 notícia por portal em cada ciclo)
setInterval(autoImportRss, 5000);
console.log("✅ Auto-atualização de RSS iniciada (a cada 5 segundos)");

app.post("/api/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === admin.user && pass === admin.pass) {
    return res.json({ success: true });
  }

  res.status(401).json({ success: false });
});

// GET RSS FEEDS
app.get("/api/rss-feeds", (req, res) => {
  res.json(rssFeeds);
});

// ADD RSS FEED
app.post("/api/rss-feeds", (req, res) => {
  const { name, url, logo } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  }
  
  // Verificar se já existe
  const exists = rssFeeds.some(f => f.url === url);
  if (exists) {
    return res.status(400).json({ error: "Este feed já existe" });
  }
  
  // Adicionar à memória
  const newFeed = { name: name.trim(), url: url.trim(), logo: logo || null };
  rssFeeds.push(newFeed);
  
  // Salvar no banco de dados
  db.run("INSERT INTO rss_feeds (name, url, logo) VALUES (?, ?, ?)", [name.trim(), url.trim(), logo || null], (err) => {
    if (err) {
      // Se deu erro, remover da memória
      rssFeeds.pop();
      return res.status(500).json({ error: "Erro ao salvar feed" });
    }
    res.json({ success: true, feeds: rssFeeds });
  });
});

// DELETE RSS FEED
app.delete("/api/rss-feeds/:index", (req, res) => {
  const index = parseInt(req.params.index);
  
  if (index < 0 || index >= rssFeeds.length) {
    return res.status(400).json({ error: "Feed não encontrado" });
  }
  
  const feedToDelete = rssFeeds[index];
  
  // Deletar do banco de dados
  db.run("DELETE FROM rss_feeds WHERE url = ?", [feedToDelete.url], (err) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao deletar feed" });
    }
    
    // Deletar da memória após sucesso no banco
    rssFeeds.splice(index, 1);
    res.json({ success: true, feeds: rssFeeds });
  });
});

// UPDATE RSS FEED LOGO
app.put("/api/rss-feeds/:index/logo", (req, res) => {
  const { index } = req.params;
  const { logo } = req.body;

  if (!logo) {
    return res.status(400).json({ error: "Logo é obrigatório" });
  }

  // Atualizar na memória pelo índice
  const feedIndex = parseInt(index);
  if (feedIndex < 0 || feedIndex >= rssFeeds.length) {
    return res.status(404).json({ error: "Feed não encontrado" });
  }

  const feed = rssFeeds[feedIndex];
  feed.logo = logo;

  // Salvar no banco de dados pela URL (identificador único)
  db.run("UPDATE rss_feeds SET logo = ? WHERE url = ?", [logo, feed.url], (err) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao atualizar logo" });
    }
    res.json({ success: true, feeds: rssFeeds });
  });
});

// UPDATE RSS FEED URL AND NAME
app.put("/api/rss-feeds/:index", (req, res) => {
  const { index } = req.params;
  const { name, url } = req.body;

  console.log("=== ATUALIZANDO FEED ===");
  console.log("Index:", index);
  console.log("Name:", name);
  console.log("Url:", url);
  console.log("Total feeds:", rssFeeds.length);
  console.log("Feeds atual:", JSON.stringify(rssFeeds.slice(0, 2), null, 2));

  if (!name || !url) {
    return res.status(400).json({ error: "Nome e URL são obrigatórios" });
  }

  // Validar índice
  const feedIndex = parseInt(index);
  if (feedIndex < 0 || feedIndex >= rssFeeds.length) {
    return res.status(404).json({ error: "Feed não encontrado" });
  }

  const feed = rssFeeds[feedIndex];
  console.log("Feed encontrado:", JSON.stringify(feed, null, 2));

  // Verificar se a nova URL já existe (exceto a atual)
  const exists = rssFeeds.some((f, i) => f.url === url.trim() && i !== feedIndex);
  if (exists) {
    return res.status(400).json({ error: "Esta URL já existe em outro feed" });
  }

  // Guardar valores antigos para reverter se necessário
  const oldName = feed.name;
  const oldUrl = feed.url;

  // Atualizar na memória
  feed.name = name.trim();
  feed.url = url.trim();

  // Salvar no banco de dados usando o ID (mais seguro para evitar conflitos UNIQUE)
  const feedId = feed.id;
  console.log("Atualizando feed com ID:", feedId);
  
  db.run("UPDATE rss_feeds SET name = ?, url = ? WHERE id = ?", [name.trim(), url.trim(), feedId], (err) => {
    if (err) {
      console.error("Erro ao atualizar feed no banco:", err);
      // Reverter mudanças na memória
      feed.name = oldName;
      feed.url = oldUrl;
      return res.status(500).json({ error: "Erro ao atualizar feed: " + err.message });
    }
    console.log("Feed atualizado com sucesso!");
    res.json({ success: true, feeds: rssFeeds });
  });
});

// GET POSTS
app.get("/api/posts", (req, res) => {
  const { source } = req.query;
  
  let query = "SELECT * FROM posts";
  let params = [];
  
  // Se houver filtro de source, aplicar
  if (source) {
    query += " WHERE source = ?";
    params.push(source);
  }
  
  query += " ORDER BY id DESC";
  
  try {
  const rows = db.prepare(query).all(params);

  // Converter caminhos de imagem relativos para URLs absolutas
  const postsWithFullImageUrls = rows.map(post => ({
    ...post,
    image: post.image && post.image.startsWith('http') 
      ? post.image 
      : post.image 
        ? `${process.env.BASE_URL || 'http://localhost:3000'}${post.image}` 
        : null
  }));

  res.json(postsWithFullImageUrls);

} catch (err) {
  res.status(500).json({ error: err.message });
}

// CREATE POST
app.post("/api/posts", async (req, res) => {
  const { title, content, image, link } = req.body;

  // Validar entrada
  if (!title || !content || !image) {
    return res.status(400).json({ error: "Título, conteúdo e imagem são obrigatórios" });
  }

  try {
    // Se a imagem for uma URL, fazer download
    let finalImage = image;
    if (image.startsWith('http')) {
      const localImageUrl = await downloadImage(image);
      finalImage = localImageUrl || image; // Usa local ou URL original
    }

    db.run(
      "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
      [title, content, finalImage, link, "Comunidade do Rock"],
      function (err) {
        if (err) return res.status(500).json(err);

        res.json({
          id: this.lastID,
          title,
          content,
          image: finalImage,
          link,
          source: "Comunidade do Rock",
          created_at: new Date().toISOString()
        });
      }
    );
  } catch (err) {
    console.error("Erro ao criar post:", err.message);
    res.status(500).json({ error: "Erro ao criar post: " + err.message });
  }
});

// DELETE POST
app.delete("/api/posts/:id", (req, res) => {
  db.run("DELETE FROM posts WHERE id = ?", req.params.id, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// UPDATE POST
app.put("/api/posts/:id", (req, res) => {
  const { title, content, image, link } = req.body;
  const id = req.params.id;

  db.run(
    "UPDATE posts SET title = ?, content = ?, image = ?, link = ? WHERE id = ?",
    [title, content, image, link, id],
    function(err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true, message: "Notícia atualizada!" });
    }
  );
});

// SUBMIT BAND
app.post("/api/bands/submit", (req, res) => {
  const {
    name,
    genre,
    city,
    state,
    year,
    members,
    biography,
    contact,
    image,
    instagram,
    facebook,
    youtube,
    spotify,
    bandcamp,
    site
  } = req.body;

  db.run(
    "INSERT INTO pending_bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site],
    function (err) {
      if (err) return res.status(500).json(err);

      res.json({
        id: this.lastID,
        message: "Banda submetida para aprovação!"
      });
    }
  );
});

// GET APPROVED BANDS
app.get("/api/bands", (req, res) => {
 try {
  const rows = db
    .prepare("SELECT * FROM bands ORDER BY id DESC")
    .all();

  res.json(rows);

} catch (err) {
  res.status(500).json({ error: err.message });
}

// CREATE BAND (ADMIN)
app.post("/api/bands", (req, res) => {
  const { name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nome da banda é obrigatório" });
  }

  db.run(
    "INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ id: this.lastID, success: true });
    }
  );
});

// GET PENDING BANDS (ADMIN)
app.get("/api/pending-bands", (req, res) => {
  try {
  const rows = db
    .prepare("SELECT * FROM bands ORDER BY id DESC")
    .all();

  res.json(rows);

} catch (err) {
  res.status(500).json({ error: err.message });
}

// SEED BANDS (Popular banco com bandas de exemplo)
app.post("/api/seed-bands", (req, res) => {
  const bandasExemplo = [
    {
      name: "Banda Four One",
      genre: "Hardcore melódico",
      city: "São Paulo",
      state: "SP",
      image: "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop",
      biography: "Uma das bandas mais promissoras da cena de hardcore melódico de São Paulo.",
      year: "2015",
      members: "João, Pedro, Lucas, Felipe",
      contact: "contato@bandafourone.com"
    },
    {
      name: "The Indies",
      genre: "Indie Rock",
      city: "Rio de Janeiro",
      state: "RJ",
      image: "https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=300&h=300&fit=crop",
      biography: "Banda indie rock do Rio de Janeiro com um som único e cativante.",
      year: "2016",
      members: "Marco, Ana, Carlos, Beatriz",
      contact: "contato@theindies.com"
    },
    {
      name: "Metal Chaos",
      genre: "Heavy Metal",
      city: "Belo Horizonte",
      state: "MG",
      image: "https://images.unsplash.com/photo-1516157786151-b8491531f063?w=300&h=300&fit=crop",
      biography: "Heavy metal com influências clássicas e modernas.",
      year: "2014",
      members: "Rafael, Gustavo, Diego, Paulo",
      contact: "contato@metalchaos.com"
    },
    {
      name: "Punk Rebels",
      genre: "Punk Rock",
      city: "Curitiba",
      state: "PR",
      image: "https://images.unsplash.com/photo-1516845328741-a47b99c22e79?w=300&h=300&fit=crop",
      biography: "Uma banda punk rock com mensagem social forte.",
      year: "2017",
      members: "Alex, Bruno, Daniel, Felipe",
      contact: "contato@punkrebels.com"
    },
    {
      name: "Grunge Revival",
      genre: "Grunge",
      city: "Porto Alegre",
      state: "RS",
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
      biography: "Revivendo o melhor do grunge dos anos 90.",
      year: "2018",
      members: "Sergio, Maria, Jorge, Patricia",
      contact: "contato@grungerevival.com"
    }
  ];

  let inserted = 0;

  bandasExemplo.forEach(banda => {
    db.run(
      "INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [banda.name, banda.genre, banda.city, banda.state, banda.year, banda.members, banda.biography, banda.contact, banda.image],
      function(err) {
        if (!err) inserted++;
        if (inserted === bandasExemplo.length) {
          res.json({ success: true, message: `${inserted} bandas adicionadas!` });
        }
      }
    );
  });
});

// IMPORT RSS
app.post("/api/import-rss", async (req, res) => {
  const { feeds } = req.body;

  if (!Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({ error: "Nenhum feed informado" });
  }

  let imported = 0;
  let feedStats = [];

  try {
    for (const feed of feeds) {
      if (!feed.url) continue;
      
      let feedImported = 0;
      
      try {
        const response = await fetchFunc(feed.url);
        if (!response.ok) {
          console.warn(`⚠️ POST /api/import-rss - Feed ${feed.name}: HTTP ${response.status}`);
          feedStats.push({ feed: feed.name, imported: 0, status: "erro_http" });
          continue;
        }
        
        let xml;
        try {
          xml = await response.text();
        } catch (parseErr) {
          console.warn(`⚠️ POST /api/import-rss - Erro ao ler resposta do feed ${feed.name}:`, parseErr.message);
          feedStats.push({ feed: feed.name, imported: 0, status: "erro_leitura" });
          continue;
        }

        const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
        
        // Tentar importar itens até conseguir PELO MENOS 1 com sucesso
        // Máximo de 15 itens para tentar
        for (let i = 0; i < Math.min(items.length, 15); i++) {
          // Se já conseguiu pelo menos 1, pode parar (mas continua if houver mais)
          // Porém vamos colocar um máximo para não processar demais
          if (feedImported > 0 && i > 5) break;
          
          try {
            const item = items[i];
            if (!item) continue;
            
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
            let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
            let content = extractContentFromItem(item);

            // VALIDAÇÃO: Não importar posts sem título ou conteúdo válido
            if (!title || !content) {
              console.warn(`⚠️ Feed "${feed.name}" - Ignorando item sem título ou conteúdo válido`);
              continue;
            }

            let image = extractImageFromItem(item, content);
            let link = extractLinkFromItem(item);
            let source = feed.name || "Desconhecida";
            
            let createdAt;
            try {
              createdAt = extractDateFromItem(item);
            } catch (dateErr) {
              console.warn(`⚠️ POST /api/import-rss - Erro ao extrair data:`, dateErr.message);
              createdAt = new Date().toISOString();
            }

            await new Promise((resolve) => {
              try {
                const row = db
                  .prepare("SELECT id FROM posts WHERE title = ?")
                  .get(title);

                if (row) {
                  return resolve();
                }
                
                if (row) {
                  return resolve();
                }
                
                // DOWNLOAD DA IMAGEM se válida
                if (!image || !image.startsWith('http')) {
                  console.warn(`⚠️ POST /api/import-rss - Item rejeitado (imagem inválida): "${title.substring(0, 40)}..."`);
                  return resolve();
                }
                
                downloadImage(image).then(localImageUrl => {
                  const finalImageUrl = localImageUrl || image;
                  
                  db.run(
                    "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                    [title, content, finalImageUrl, link, source],
                    function(err) {
                      if (err) {
                        console.warn(`⚠️ POST /api/import-rss - Erro ao inserir item:`, err.message);
                      } else {
                        imported += 1;
                        feedImported += 1;
                        console.log(`✅ Feed "${feed.name}" - Item ${feedImported} importado: "${title.substring(0, 50)}..."`);
                      }
                      resolve();
                    }
                  );
                }).catch(() => {
                  // Se falhar o download, tenta com URL original
                  db.run(
                    "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                    [title, content, image, link, source],
                    function(err) {
                      if (err) {
                        console.warn(`⚠️ POST /api/import-rss - Erro ao inserir item:`, err.message);
                      } else {
                        imported += 1;
                        feedImported += 1;
                      }
                      resolve();
                    }
                  );
                });
              });
            });
          } catch (itemErr) {
            console.warn(`⚠️ POST /api/import-rss - Erro ao processar item ${i + 1}:`, itemErr.message);
            continue;
          }
        }
        
        feedStats.push({ feed: feed.name, imported: feedImported, status: feedImported > 0 ? "sucesso" : "nenhum" });
        if (feedImported > 0) {
          console.log(`📊 Feed "${feed.name}" - ${feedImported} notícia(s) importada(s)`);
        } else {
          console.warn(`⚠️ Feed "${feed.name}" - Nenhuma notícia foi importada`);
        }
      } catch (feedErr) {
        console.warn(`⚠️ POST /api/import-rss - Erro ao processar feed ${feed.name}:`, feedErr.message);
        feedStats.push({ feed: feed.name, imported: 0, status: "erro_geral" });
        continue;
      }
    }

    res.json({ success: true, imported, feedStats });
  } catch (err) {
    console.error("❌ POST /api/import-rss - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao importar feeds" });
  }
});

// IMPORT RSS SINGLE (Importar um feed individual)
app.post("/api/import-rss-single", async (req, res) => {
  const { feed } = req.body;

  if (!feed || !feed.url) {
    return res.status(400).json({ error: "Feed inválido" });
  }

  let imported = 0;

  try {
    const response = await fetchFunc(feed.url);
    if (!response.ok) {
      console.warn(`⚠️ POST /api/import-rss-single - HTTP ${response.status}`);
      return res.status(500).json({ error: "Não foi possível acessar o feed" });
    }
    
    let xml;
    try {
      xml = await response.text();
    } catch (parseErr) {
      console.warn(`⚠️ POST /api/import-rss-single - Erro ao ler resposta:`, parseErr.message);
      return res.status(500).json({ error: "Erro ao processar resposta do feed" });
    }
    
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    
    // Tentar importar itens até conseguir PELO MENOS 1 com sucesso
    // Máximo de 15 itens para tentar
    for (let i = 0; i < Math.min(items.length, 15); i++) {
      // Se já conseguiu pelo menos 1, pode parar (mas continua if houver mais)
      // Porém vamos colocar um máximo para não processar demais
      if (imported > 0 && i > 5) break;
      
      try {
        const item = items[i];
        if (!item) continue;
        
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
        let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
        let content = extractContentFromItem(item);
        let image = extractImageFromItem(item, content);

        // VALIDAÇÃO RIGOROSA: Só importar se tiver título, conteúdo e imagem
        if (!title || !content || !image) {
          continue;
        }
        let link = extractLinkFromItem(item);
        let source = feed.name || "Desconhecida";
        
        let createdAt;
        try {
          createdAt = extractDateFromItem(item);
        } catch (dateErr) {
          console.warn(`⚠️ POST /api/import-rss-single - Erro ao extrair data:`, dateErr.message);
          createdAt = new Date().toISOString();
        }

        await new Promise((resolve) => {
          try {
  const row = db
    .prepare("SELECT id FROM posts WHERE title = ?")
    .get(title);

  if (row) {
    return resolve();
  }

} catch (err) {
  console.warn(`⚠️ POST /api/import-rss-single - Erro ao verificar item:`, err.message);
  return resolve();
}
            
            // DOWNLOAD DA IMAGEM
            downloadImage(image).then(localImageUrl => {
              const finalImageUrl = localImageUrl || image;
              
              db.run(
                "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                [title, content, finalImageUrl, link, source],
                function(err) {
                  if (err) {
                    console.warn(`⚠️ POST /api/import-rss-single - Erro ao inserir item:`, err.message);
                  } else {
                    imported += 1;
                    console.log(`✅ Feed "${feed.name}" - Item ${imported} importado: "${title.substring(0, 50)}..."`);
                  }
                  resolve();
                }
              );
            }).catch(() => {
              // Se falhar o download, tenta com URL original
              db.run(
                "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                [title, content, image, link, source],
                function(err) {
                  if (err) {
                    console.warn(`⚠️ POST /api/import-rss-single - Erro ao inserir item:`, err.message);
                  } else {
                    imported += 1;
                  }
                  resolve();
                }
              );
            });
          });
        });
      } catch (itemErr) {
        console.warn(`⚠️ POST /api/import-rss-single - Erro ao processar item ${i + 1}:`, itemErr.message);
        continue;
      }
    }

    if (imported === 0) {
      console.warn(`⚠️ Feed "${feed.name}" - Nenhuma notícia foi importada`);
    } else {
      console.log(`📊 Feed "${feed.name}" - ${imported} notícia(s) importada(s)`);
    }
    
    res.json({ success: true, imported });
  } catch (err) {
    console.error("❌ POST /api/import-rss-single - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao importar feed" });
  }
});

// RE-IMPORT RSS (atualiza imagens das notícias existentes)
app.post("/api/reimport-rss", async (req, res) => {
  const { feeds } = req.body;

  if (!Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({ error: "Nenhum feed informado" });
  }

  let updated = 0;
  let created = 0;

  try {
    for (const feed of feeds) {
      if (!feed.url) continue;
      
      try {
        const response = await fetchFunc(feed.url);
        if (!response.ok) {
          console.warn(`⚠️ POST /api/reimport-rss - Feed ${feed.name}: HTTP ${response.status}`);
          continue;
        }
        
        let xml;
        try {
          xml = await response.text();
        } catch (parseErr) {
          console.warn(`⚠️ POST /api/reimport-rss - Erro ao ler resposta do feed ${feed.name}:`, parseErr.message);
          continue;
        }

        const items = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
        
        for (let i = 0; i < Math.min(items.length, 5); i++) {
          try {
            const item = items[i];
            if (!item) continue;
            
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
            let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;
            let content = extractContentFromItem(item);
            let image = extractImageFromItem(item, content);

            // VALIDAÇÃO RIGOROSA: Só importar se tiver título, conteúdo e imagem
            if (!title || !content || !image) {
              continue;
            }

            let link = extractLinkFromItem(item);
            let source = feed.name || "Desconhecida";
            
            let createdAt;
            try {
              createdAt = extractDateFromItem(item);
            } catch (dateErr) {
              console.warn(`⚠️ POST /api/reimport-rss - Erro ao extrair data:`, dateErr.message);
              createdAt = new Date().toISOString();
            }

            await new Promise((resolve) => {
              try {
  const existingPost = db
    .prepare("SELECT id, image FROM posts WHERE title = ?")
    .get(title);

} catch (err) {
  console.warn(`⚠️ POST /api/reimport-rss - Erro ao verificar item:`, err.message);
  return resolve();
}

                if (existingPost) {
                  if (!existingPost.image && image) {
                    db.run(
                      "UPDATE posts SET image = ?, link = ?, source = ? WHERE id = ?",
                      [image, link, source, existingPost.id],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ POST /api/reimport-rss - Erro ao atualizar item:`, err.message);
                        } else {
                          updated += 1;
                        }
                        resolve();
                      }
                    );
                  } else if (!existingPost.link && link) {
                    db.run(
                      "UPDATE posts SET link = ?, source = ? WHERE id = ?",
                      [link, source, existingPost.id],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ POST /api/reimport-rss - Erro ao atualizar item:`, err.message);
                        } else {
                          updated += 1;
                        }
                        resolve();
                      }
                    );
                  } else {
                    resolve();
                  }
                } else {
                  // DOWNLOAD DA IMAGEM para novo post
                  downloadImage(image).then(localImageUrl => {
                    const finalImageUrl = localImageUrl || image;
                    
                    db.run(
                      "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                      [title, content, finalImageUrl, link, source],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ POST /api/reimport-rss - Erro ao inserir item:`, err.message);
                        } else {
                          created += 1;
                        }
                        resolve();
                      }
                    );
                  }).catch(() => {
                    // Se falhar o download, tenta com URL original
                    db.run(
                      "INSERT INTO posts (title, content, image, link, source) VALUES (?, ?, ?, ?, ?)",
                      [title, content, image, link, source],
                      (err) => {
                        if (err) {
                          console.warn(`⚠️ POST /api/reimport-rss - Erro ao inserir item:`, err.message);
                        } else {
                          created += 1;
                        }
                        resolve();
                      }
                    );
                  });
                }
              });
            });
          } catch (itemErr) {
            console.warn(`⚠️ POST /api/reimport-rss - Erro ao processar item ${i + 1} do feed ${feed.name}:`, itemErr.message);
            continue;
          }
        }
      } catch (feedErr) {
        console.warn(`⚠️ POST /api/reimport-rss - Erro ao processar feed ${feed.name}:`, feedErr.message);
        continue;
      }
    }

    res.json({ success: true, updated, created });
  } catch (err) {
    console.error("❌ POST /api/reimport-rss - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao reimportar feeds" });
  }
});

// FIX MISSING IMAGES - Corrige notícias sem imagem
app.post("/api/fix-missing-images", async (req, res) => {
  try {
    console.log("🔧 POST /api/fix-missing-images - Iniciando correção de imagens ausentes...");
    
    // Buscar todas as notícias sem imagem
    try {
  const posts = db
    .prepare("SELECT * FROM posts WHERE image IS NULL OR image = ''")
    .all();

  // se você usa async depois, pode manter aqui fora
  // exemplo: baixar imagens, processar etc

  res.json(posts);

} catch (err) {
  console.error("❌ Erro ao buscar posts sem imagem:", err.message);
  res.status(500).json({ error: "Erro ao buscar posts" });
}

      if (!posts || posts.length === 0) {
        console.log("✅ Nenhuma notícia sem imagem para corrigir");
        return res.json({ success: true, fixed: 0, message: "Nenhuma notícia sem imagem" });
      }

      console.log(`📝 Encontradas ${posts.length} notícias sem imagem`);

      // Buscar todos os feeds RSS
      try {
  const feeds = db
    .prepare("SELECT id, url FROM rss_feeds")
    .all();

  // aqui você pode usar async normalmente
  for (const feed of feeds) {
    // exemplo:
    // await processFeed(feed.url);
  }

  res.json(feeds);

} catch (err) {
  console.error("❌ Erro ao buscar feeds:", err.message);
  res.status(500).json({ error: "Erro ao buscar feeds" });
}

        let fixed = 0;
        const feedUrls = {};
        
        // Mapear feeds por URL
        if (feeds) {
          feeds.forEach(feed => {
            feedUrls[feed.url] = feed.id;
          });
        }

        // Processar cada notícia sem imagem
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          
          try {
            // Tentar extrair imagem do link original ou feed
            let foundImage = "";
            
            // Se temos o source (URL do feed), buscar o feed e procurar novamente
            if (post.source) {
              const response = await fetchFunc(post.source, { timeout: 10000 });
              const xml = await response.text();
              
              // Procurar o item correspondente no XML
              const itemRegex = new RegExp(
                `<item[^>]*>([\\s\\S]*?)<title>\\s*${post.title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*<\\/title>([\\s\\S]*?)<\\/item>`,
                'i'
              );
              
              const itemMatch = xml.match(itemRegex);
              if (itemMatch) {
                const itemContent = itemMatch[0];
                foundImage = extractImageFromItem(itemContent, post.content);
              }
            }
            
            // Se encontrou imagem, atualizar
            if (foundImage) {
              db.run(
                "UPDATE posts SET image = ? WHERE id = ?",
                [foundImage, post.id],
                (err) => {
                  if (err) {
                    console.warn(`⚠️ Erro ao atualizar imagem do post ${post.id}:`, err.message);
                  } else {
                    fixed += 1;
                    console.log(`✅ Imagem adicionada ao post "${post.title.substring(0, 50)}..."`);
                  }
                }
              );
            } else {
              console.log(`⚠️ Nenhuma imagem encontrada para "${post.title.substring(0, 50)}..."`);
            }
          } catch (itemErr) {
            console.warn(`⚠️ Erro ao processar post ${post.id}:`, itemErr.message);
            continue;
          }
        }

        // Aguardar 1 segundo para completar os updates
        setTimeout(() => {
          console.log(`📊 Processo concluído - ${fixed} imagens corrigidas`);
          res.json({ 
            success: true, 
            fixed: fixed, 
            total: posts.length,
            message: `${fixed} de ${posts.length} imagens foram corrigidas` 
          });
        }, 1000);
      });
    });
  } catch (err) {
    console.error("❌ POST /api/fix-missing-images - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao corrigir imagens" });
  }
});

// FIX SOURCE - Corrige o source das notícias por URL de feed antigo
app.post("/api/fix-source", async (req, res) => {
  try {
    const { oldSource, newSource } = req.body;
    
    if (!oldSource || !newSource) {
      return res.status(400).json({ error: "oldSource e newSource são obrigatórios" });
    }

    console.log(`🔧 POST /api/fix-source - Corrigindo source de "${oldSource}" para "${newSource}"...`);
    
    db.run(
      "UPDATE posts SET source = ? WHERE source = ?",
      [newSource, oldSource],
      function(err) {
        if (err) {
          console.error("❌ Erro ao atualizar source:", err.message);
          return res.status(500).json({ error: "Erro ao atualizar source" });
        }
        
        console.log(`✅ ${this.changes} notícia(s) tiveram source atualizado`);
        res.json({ 
          success: true, 
          updated: this.changes,
          message: `${this.changes} notícia(s) tiveram source atualizado de "${oldSource}" para "${newSource}"`
        });
      }
    );
  } catch (err) {
    console.error("❌ POST /api/fix-source - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao corrigir source" });
  }
});

// FIX IMAGE URLS - Corrige URLs de imagens inválidas
app.post("/api/fix-image-urls", async (req, res) => {
  try {
    console.log(`🔧 POST /api/fix-image-urls - Corrigindo URLs de imagens...`);
    
    try {
  const posts = db
    .prepare("SELECT id, image FROM posts WHERE image IS NOT NULL AND image != ''")
    .all();

  res.json(posts);

} catch (err) {
  console.error("❌ Erro ao buscar posts:", err.message);
  res.status(500).json({ error: "Erro ao buscar posts" });
}

      let fixed = 0;
      
      posts.forEach(post => {
        let newImage = post.image;
        let changed = false;
        
        // 1. Rejeitar embeds do YouTube - não são imagens
        if (newImage.includes("youtube.com/embed")) {
          console.log(`⚠️ Removendo embed do YouTube do post ${post.id}`);
          newImage = "";
          changed = true;
        } else {
          // 2. Remover domínio duplicado tipo 1: https://domain.com/www.domain.com/path
          const domainDuplicatePattern1 = /^(https?:\/\/[^\/]+)\/(www\.[^\s\/]+\.com)\/(.+)$/i;
          const match1 = newImage.match(domainDuplicatePattern1);
          if (match1) {
            const baseUrl = match1[1];
            const path = match1[3];
            newImage = `${baseUrl}/${path}`;
            changed = true;
            console.log(`✅ URL duplicada (tipo 1) corrigida do post ${post.id}`);
          }
          
          // 3. Remover domínio duplicado tipo 2: https://domain.com/uploads.domain.com/path
          if (!changed) {
            // Padrão específico: /uploads.dominio.com/ no meio do path
            // Ex: https://www.tenhomaisdiscosqueamigos.com/uploads.tenhomaisdiscosqueamigos.com/2026/03/file.jpg
            // Deve virar: https://www.tenhomaisdiscosqueamigos.com/uploads/2026/03/file.jpg
            const pattern = /^(https?:\/\/[^\/]+)\/uploads\.([^\/]+\.com)\/(.+)$/i;
            const match2 = newImage.match(pattern);
            if (match2) {
              const baseUrl = match2[1];
              const path = match2[3];
              newImage = `${baseUrl}/uploads/${path}`;
              changed = true;
              console.log(`✅ URL duplicada (tipo 2) corrigida do post ${post.id}`);
              console.log(`   De: ${post.image}`);
              console.log(`   Para: ${newImage}`);
            }
          }
        }
        
        // 4. Validar que ainda tem uma URL válida
        if (newImage && !newImage.startsWith("http")) {
          newImage = "";
          changed = true;
        }
        
        if (changed && newImage !== post.image) {
          db.run(
            "UPDATE posts SET image = ? WHERE id = ?",
            [newImage, post.id],
            (err) => {
              if (!err) {
                fixed++;
              }
            }
          );
        }
      });

      setTimeout(() => {
        console.log(`📊 Processo concluído - ${fixed} URL(s) de imagem corrigida(s)`);
        res.json({ 
          success: true, 
          fixed: fixed,
          message: `${fixed} URL(s) de imagem foram corrigidas`
        });
      }, 500);
    });
  } catch (err) {
    console.error("❌ POST /api/fix-image-urls - Erro geral:", err.message);
    res.status(500).json({ error: "Erro ao corrigir URLs de imagens" });
  }
});

// TEST RSS IMAGE EXTRACTION - Testa extração de imagens de um feed
app.post("/api/test-rss-images", async (req, res) => {
  try {
    const { feedUrl } = req.body;
    
    if (!feedUrl) {
      return res.status(400).json({ error: "feedUrl é obrigatório" });
    }

    console.log(`🧪 POST /api/test-rss-images - Testando ${feedUrl}...`);
    
    const response = await fetchFunc(feedUrl, { timeout: 10000 });
    const xml = await response.text();
    
    // Extrair todos os items
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items = [];
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[0];
      const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].substring(0, 50) : "Sem título";
      
      const image = extractImageFromItem(itemXml, "");
      
      items.push({
        title: title,
        hasImage: !!image,
        imageUrl: image || null
      });
    }
    
    console.log(`✅ Feed analisado: ${items.length} itens encontrados`);
    
    const withImages = items.filter(i => i.hasImage).length;
    
    res.json({
      success: true,
      feedUrl: feedUrl,
      totalItems: items.length,
      itemsWithImages: withImages,
      itemsWithoutImages: items.length - withImages,
      sampleItems: items.slice(0, 5),
      allItems: items
    });
  } catch (err) {
    console.error("❌ POST /api/test-rss-images - Erro:", err.message);
    res.status(500).json({ error: "Erro ao testar feed: " + err.message });
  }
});

// APPROVE BAND

app.post("/api/approve-band/:id", (req, res) => {
  const id = req.params.id;

  // Get pending band
  try {
  const band = db
    .prepare("SELECT * FROM pending_bands WHERE id = ?")
    .get(id);

  if (!band) {
    return res.status(404).json({ error: "Banda não encontrada" });
  }

  // continua o fluxo normal aqui 👇
  res.json(band);

} catch (err) {
  res.status(500).json({ error: err.message });
}

    // Insert into bands
    db.run(
      "INSERT INTO bands (name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [band.name, band.genre, band.city, band.state, band.year, band.members, band.biography, band.contact, band.image, band.instagram, band.facebook, band.youtube, band.spotify, band.bandcamp, band.site],
      (err) => {
        if (err) return res.status(500).json(err);

        // Delete from pending
        db.run("DELETE FROM pending_bands WHERE id = ?", id, (err) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true, message: "Banda aprovada!" });
        });
      }
    );
  });
});

// DELETE BAND
app.delete("/api/bands/:id", (req, res) => {
  db.run("DELETE FROM bands WHERE id = ?", req.params.id, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// UPDATE BAND
app.put("/api/bands/:id", (req, res) => {
  const { name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site } = req.body;
  const id = req.params.id;

  db.run(
    "UPDATE bands SET name = ?, genre = ?, city = ?, state = ?, year = ?, members = ?, biography = ?, contact = ?, image = ?, instagram = ?, facebook = ?, youtube = ?, spotify = ?, bandcamp = ?, site = ? WHERE id = ?",
    [name, genre, city, state, year, members, biography, contact, image, instagram, facebook, youtube, spotify, bandcamp, site, id],
    function(err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true, message: "Banda atualizada!" });
    }
  );
});

// MIGRAÇÃO - Preencher created_at em notícias antigas
app.post("/api/migrate", (req, res) => {
  // Adicionar coluna created_at se não existir
  db.run(`ALTER TABLE posts ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
    // Ignorar erro se coluna já existe
    
    // Preencher created_at com CURRENT_TIMESTAMP para notícias sem data
    db.run(`UPDATE posts SET created_at = datetime('now') WHERE created_at IS NULL`, function(err) {
      if (err) return res.status(500).json({ error: "Erro na migração: " + err.message });
      res.json({ success: true, message: "Migração completada! " + this.changes + " notícias atualizadas." });
    });
  });
});

// MIGRAÇÃO - Adicionar coluna logo na tabela rss_feeds
db.run(`ALTER TABLE rss_feeds ADD COLUMN logo TEXT`, (err) => {
  if (err && err.message.includes("duplicate column")) {
    // Coluna já existe, tudo bem
  } else if (err) {
    console.warn("⚠️ Erro ao adicionar coluna logo:", err.message);
  } else {
    console.log("✅ Coluna 'logo' adicionada à tabela rss_feeds");
  }
});

// ====== EVENTOS ======
// GET EVENTS
app.get("/api/events", (req, res) => {
  try {
  const rows = db
    .prepare("SELECT * FROM events ORDER BY date ASC")
    .all();

  res.json(rows || []);

} catch (err) {
  res.status(500).json({ error: err.message });
}

// CREATE EVENT
app.post("/api/events", (req, res) => {
  const { title, artist, date, time, location, city, state, image, ticket_link, description } = req.body;
  const created_at = new Date().toISOString();

  if (!title || !date) {
    return res.status(400).json({ error: "Título e data são obrigatórios" });
  }

  db.run(
    "INSERT INTO events (title, artist, date, time, location, city, state, image, ticket_link, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [title, artist, date, time, location, city, state, image, ticket_link, description, created_at],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ id: this.lastID, success: true });
    }
  );
});

// UPDATE EVENT
app.put("/api/events/:id", (req, res) => {
  const { title, artist, date, time, location, city, state, image, ticket_link, description } = req.body;
  const { id } = req.params;

  if (!title || !date) {
    return res.status(400).json({ error: "Título e data são obrigatórios" });
  }

  db.run(
    "UPDATE events SET title = ?, artist = ?, date = ?, time = ?, location = ?, city = ?, state = ?, image = ?, ticket_link = ?, description = ? WHERE id = ?",
    [title, artist, date, time, location, city, state, image, ticket_link, description, id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// DELETE EVENT
app.delete("/api/events/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM events WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// GET INTERVIEWS
app.get("/api/events", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM events ORDER BY date ASC")
      .all();

    res.json(rows || []);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE INTERVIEW
app.post("/api/interviews", (req, res) => {
  const { title, artist, content, image, date } = req.body;
  const created_at = new Date().toISOString();

  if (!title || !artist) {
    return res.status(400).json({ error: "Título e artista são obrigatórios" });
  }

  db.run(
    "INSERT INTO interviews (title, artist, content, image, date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [title, artist, content, image, date, created_at],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ id: this.lastID, success: true });
    }
  );
});

// UPDATE INTERVIEW
app.put("/api/interviews/:id", (req, res) => {
  const { title, artist, content, image, date } = req.body;
  const { id } = req.params;

  if (!title || !artist) {
    return res.status(400).json({ error: "Título e artista são obrigatórios" });
  }

  db.run(
    "UPDATE interviews SET title = ?, artist = ?, content = ?, image = ?, date = ? WHERE id = ?",
    [title, artist, content, image, date, id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// DELETE INTERVIEW
app.delete("/api/interviews/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM interviews WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend com SQLite ON 🔥 (Porta ${PORT})`);
});