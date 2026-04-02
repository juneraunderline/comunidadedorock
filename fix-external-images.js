const Database = require('better-sqlite3');
const path = require('path');
const { downloadImage } = require('./image-downloader');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// Buscar posts com imagens externas
const rows = db
  .prepare("SELECT id, title, image FROM posts WHERE image LIKE 'http%'")
  .all();

console.log(`\n🔄 Encontrados ${rows.length} posts com imagens externas\n`);

if (!rows || rows.length === 0) {
  console.log('✅ Nenhuma imagem externa para processar!');
  process.exit(0);
}

let index = 0;

(async () => {
  for (const post of rows) {
    index++;

    console.log(`[${index}/${rows.length}] Baixando: ${post.title.substring(0, 50)}...`);
    console.log(`URL: ${post.image}`);

    try {
      const localUrl = await downloadImage(post.image);

      if (!localUrl) {
        console.log(`⚠️ Falhou ao baixar\n`);
        continue;
      }

      console.log(`✅ Salvo como: ${localUrl}`);

      // Atualizar banco (better-sqlite3)
      db.prepare(
        "UPDATE posts SET image = ? WHERE id = ?"
      ).run(localUrl, post.id);

      console.log(`✅ Banco atualizado para post ${post.id}\n`);

    } catch (error) {
      console.error(`❌ Erro ao processar post ${post.id}:`, error.message);
    }
  }

  console.log('\n✅ Processo concluído!');
  db.close();
})();