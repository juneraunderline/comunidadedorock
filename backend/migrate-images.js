const Database = require("better-sqlite3");
const { downloadImage } = require("./image-downloader");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

async function migrateImagesToLocal() {
  console.log("🔄 Iniciando migração de imagens para local...\n");

  try {
    const rows = db
      .prepare("SELECT id, title, image FROM posts WHERE image LIKE 'http%'")
      .all();

    if (!rows || rows.length === 0) {
      console.log("✅ Nenhum post com imagens externas para migrar!");
      return;
    }

    console.log(`📊 Encontrados ${rows.length} posts com imagens externas\n`);

    const updateStmt = db.prepare("UPDATE posts SET image = ? WHERE id = ?");

    let migrated = 0;
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
              migrated++;
            } else {
              console.warn(`⚠️ Post ID ${row.id}: Nenhuma linha atualizada`);
              failed++;
            }
          } catch (dbErr) {
            console.error(
              `❌ Post ID ${row.id}: Erro ao atualizar -`,
              dbErr.message
            );
            failed++;
          }
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

    console.log("\n✅ Migração concluída!");
  } catch (err) {
    console.error("❌ Erro geral:", err.message);
  } finally {
    db.close();
  }
}

migrateImagesToLocal();