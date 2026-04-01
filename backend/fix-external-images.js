const Database = require("better-sqlite3");
const path = require("path");
const { downloadImage } = require("./image-downloader");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

// Buscar posts com imagens externas
const rows = db
  .prepare("SELECT id, title, image FROM posts WHERE image LIKE 'http%'")
  .all();

(async () => {
  console.log(`\n🔄 Encontrados ${rows.length} posts com imagens externas\n`);

  if (rows.length === 0) {
    console.log("✅ Nenhuma imagem externa para processar!");
    db.close();
    return;
  }

  const updateStmt = db.prepare("UPDATE posts SET image = ? WHERE id = ?");

  let processos = 0;

  for (const post of rows) {
    console.log(
      `[${processos + 1}/${rows.length}] Baixando: ${post.title.substring(0, 50)}...`
    );
    console.log(`                    URL: ${post.image}`);

    try {
      const localUrl = await downloadImage(post.image);

      if (localUrl) {
        console.log(`✅ Salvo como: ${localUrl}\n`);

        try {
          const result = updateStmt.run(localUrl, post.id);

          if (result.changes > 0) {
            console.log(`✅ Banco atualizado para post ${post.id}\n`);
          } else {
            console.log(`⚠️ Nenhuma atualização para post ${post.id}\n`);
          }
        } catch (dbErr) {
          console.error(`❌ Erro ao atualizar post ${post.id}:`, dbErr.message);
        }
      } else {
        console.log(`⚠️ Falhou ao baixar\n`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar: ${error.message}\n`);
    }

    processos++;
  }

  console.log("\n✅ Processo concluído!");
  db.close();
})();