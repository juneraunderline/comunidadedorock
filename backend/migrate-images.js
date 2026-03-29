const sqlite3 = require("sqlite3").verbose();
const { downloadImage } = require("./image-downloader");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

async function migrateImagesToLocal() {
  console.log("🔄 Iniciando migração de imagens para local...\n");

  return new Promise((resolve) => {
    db.all("SELECT id, title, image FROM posts WHERE image LIKE 'http%'", [], async (err, rows) => {
      if (err) {
        console.error("❌ Erro ao buscar posts:", err.message);
        return resolve();
      }

      if (!rows || rows.length === 0) {
        console.log("✅ Nenhum post com imagens externas para migrar!");
        db.close();
        return resolve();
      }

      console.log(`📊 Encontrados ${rows.length} posts com imagens externas\n`);

      let migrated = 0;
      let failed = 0;

      for (const row of rows) {
        try {
          const localImageUrl = await downloadImage(row.image);
          
          if (localImageUrl) {
            await new Promise((resolveUpdate) => {
              db.run(
                "UPDATE posts SET image = ? WHERE id = ?",
                [localImageUrl, row.id],
                (err) => {
                  if (err) {
                    console.error(`❌ Post ID ${row.id}: Erro ao atualizar -`, err.message);
                    failed++;
                  } else {
                    console.log(`✅ Post ID ${row.id}: "${row.title.substring(0, 40)}..." -> ${localImageUrl}`);
                    migrated++;
                  }
                  resolveUpdate();
                }
              );
            });
          } else {
            console.warn(`⚠️ Post ID ${row.id}: Falha ao baixar imagem`);
            failed++;
          }
        } catch (err) {
          console.error(`❌ Post ID ${row.id}: Erro -`, err.message);
          failed++;
        }
      }

      console.log(`\n📊 Resumo da migração:`);
      console.log(`✅ Migrados com sucesso: ${migrated}`);
      console.log(`❌ Falharam: ${failed}`);

      db.close(() => {
        console.log("\n✅ Migração concluída!");
        resolve();
      });
    });
  });
}

migrateImagesToLocal();
