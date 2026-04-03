const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('RSS.db');
const tmdqaUrl = 'https://www.tenhomaisdiscosqueamigos.com/feed/';

async function updateTMDQA() {
  try {
    const response = await fetch(tmdqaUrl);
    const xml = await response.text();
    
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    console.log(`✅ Feed TMDQA carregado: ${items.length} itens`);
    
    // Função para sanitizar URLs tipo 2
    function sanitizeImageUrl(url) {
      if (!url || !url.startsWith('http')) return '';
      if (url.includes('youtube.com/embed')) return '';
      
      // Tipo 2: /uploads.dominio.com/ → /uploads/
      const pattern = /^(https?:\/\/[^\/]+)\/uploads\.([^\/]+\.com)\/(.+)$/i;
      const match = url.match(pattern);
      if (match) {
        return `${match[1]}/uploads/${match[3]}`;
      }
      return url;
    }
    
    // Para cada item, extrair imagem
    for (let i = 0; i < Math.min(7, items.length); i++) {
      const item = items[i];
      const postId = 22 - i; // IDs: 22, 21, 20, 19, 18, 17, 16
      
      let image = '';
      
      // Tentar extrair de media:content
      const mediaMatch = item.match(/<media:content[^>]*url=["']([^"']+)["']/i);
      if (mediaMatch) image = mediaMatch[1];
      
      // Tentar extrair de media:thumbnail
      if (!image) {
        const thumbMatch = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
        if (thumbMatch) image = thumbMatch[1];
      }
      
      // Sanitizar URL
      image = sanitizeImageUrl(image);
      
      const titleMatch = item.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].substring(0, 40) : 'N/A';
      
      console.log(`  ID ${postId}: ${title}...`);
      console.log(`    Imagem: ${image.substring(0, 80)}`);
      
      db.run(
        "UPDATE posts SET image = ? WHERE id = ?",
        [image, postId],
        (err) => {
          if (err) console.error(`    ❌ Erro: ${err.message}`);
        }
      );
    }
    
    setTimeout(() => {
      db.close();
      console.log('✅ Processo concluído');
    }, 1000);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    db.close();
  }
}

updateTMDQA();
