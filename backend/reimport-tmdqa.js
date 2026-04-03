const Database = require("better-sqlite3");

const db = new Database("RSS.db");
const tmdqaUrl = "https://www.tenhomaisdiscosqueamigos.com/feed/";

async function updateTMDQA() {
  try {
    const response = await fetch(tmdqaUrl);
    const xml = await response.text();

    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    console.log(`✅ Feed TMDQA carregado: ${items.length} itens`);

    function sanitizeImageUrl(url) {
      if (!url || !url.startsWith("http")) return "";
      if (url.includes("youtube.com/embed")) return "";

      const pattern = /^(https?:\/\/[^\/]+)\/uploads\.([^\/]+\.com)\/(.+)$/i;
      const match = url.match(pattern);
      if (match) {
        return `${match[1]}/uploads/${match[3]}`;
      }
      return url;
    }

    // Preparar statement uma única vez (mais eficiente)
    const updateStmt = db.prepare("UPDATE posts SET image = ? WHERE id = ?");

    for (let i = 0; i < Math.min(7, items.length); i++) {
      const item = items[i];
      const postId = 22 - i;

      let image = "";

      // media:content
      const mediaMatch = item.match(/<media:content[^>]*url=["']([^"']+)["']/i);
      if (mediaMatch) image = mediaMatch[1];

      // media:thumbnail
      if (!image) {
        const thumbMatch = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
        if (thumbMatch) image = thumbMatch[1];
      }

      image = sanitizeImageUrl(image);

      const titleMatch = item.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].substring(0, 40) : "N/A";

      console.log(`  ID ${postId}: ${title}...`);
      console.log(`    Imagem: ${image.substring(0, 80)}`);

      try {
        const result = updateStmt.run(image, postId);
        if (result.changes === 0) {
          console.log(`    ⚠️ Nenhuma linha atualizada para ID ${postId}`);
        }
      } catch (err) {
        console.error(`    ❌ Erro: ${err.message}`);
      }
    }

    console.log("✅ Processo concluído");
  } catch (err) {
    console.error("❌ Erro:", err.message);
  } finally {
    db.close();
  }
}

updateTMDQA();