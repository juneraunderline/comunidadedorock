const Database = require("better-sqlite3");
const { downloadImage } = require("./image-downloader");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

async function downloadMissingImages() {
  console.log("🔄 Baixando imagens dos posts novos que tinham URLs externas...\n");

  try {
    const rows = db
      .prepare("SELECT id, title, image FROM posts WHERE image LIKE 'http%' ORDER BY id")
      .all();

    if (!rows || rows.length === 0) {
      console.log("✅ Nenhuma imagem externa encontrada!");
      return;
    }

    console.log(`📊 Encontrados ${rows.length} posts com imagens externas\n`);

    const updateStmt = db.prepare("UPDATE posts SET image = ? WHERE id = ?");
    const deleteStmt = db.prepare("DELETE FROM posts WHERE id = ?");

    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const localImageUrl = await downloadImage(row.image);

        if (localImageUrl) {
          try {
            const result = updateStmt.run(localImageUrl, row.id);

            if (result.changes > 0) {
              console.log(
                `✅ Post ID ${row.id}: "${row.title.substring(0, 40)}..." -> ${localImageUrl}`
              );
              updated++;
            } else {
              console.warn(`⚠️ Post ID ${row.id}: Nenhuma atualização realizada`);
              failed++;
            }
          } catch (dbErr) {
            console.error(`❌ Post ID ${row.id}: Erro ao atualizar -`, dbErr.message);
            failed++;
          }
        } else {
          console.warn(`⚠️ Post ID ${row.id}: Falha ao baixar imagem (será deletado)`);

          try {
            deleteStmt.run(row.id);
            failed++;
            console.log(`🗑️ Post ID ${row.id} deletado`);
          } catch (delErr) {
            console.error(`❌ Erro ao deletar post ${row.id}:`, delErr.message);
          }
        }
      } catch (err) {
        console.error(`❌ Post ID ${row.id}: Erro -`, err.message);
        failed++;
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`✅ Atualizados: ${updated}`);
    console.log(`❌ Problemas (falha/download/deleção): ${failed}`);

    console.log("\n🎉 Conclusão!");
  } catch (err) {
    console.error("❌ Erro geral:", err.message);
  } finally {
    db.close();
  }
}

downloadMissingImages();