const sqlite3 = require("sqlite3").verbose();
const { downloadImage } = require("./image-downloader");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

async function downloadMissingImages() {
  console.log("🔄 Baixando imagens dos posts novos que tínham URLs externas...\n");

  return new Promise((resolve) => {
    db.all("SELECT id, title, image FROM posts WHERE image LIKE 'http%' ORDER BY id", [], async (err, rows) => {
      if (err) {
        console.error("❌ Erro ao buscar posts:", err.message);
        db.close();
        return resolve();
      }

      if (!rows || rows.length === 0) {
        console.log("✅ Nenhuma imagem externa encontrada!");
        db.close();
        return resolve();
      }

     for (const row of rows) {
  try {
    const localImageUrl = await downloadImage(row.image);

    if (localImageUrl) {
      try {
        db.prepare("UPDATE posts SET image = ? WHERE id = ?")
          .run(localImageUrl, row.id);

        console.log(`✅ Post ID ${row.id}: "${row.title.substring(0, 40)}..." -> ${localImageUrl}`);
        updated++;
      } catch (err) {
        console.error(`❌ Post ID ${row.id}: Erro ao atualizar -`, err.message);
        failed++;
      }
    }
  } catch (err) {
    console.error(`❌ Post ID ${row.id}: Erro geral -`, err.message);
    failed++;
  }
}
          } else {
            console.warn(`⚠️ Post ID ${row.id}: Falha ao baixar imagem (será deletado)`);
            
            // Deletar post que não conseguiu fazer download da imagem
            await new Promise((resolveDelete) => {
              db.run("DELETE FROM posts WHERE id = ?", [row.id], (err) => {
                if (!err) {
                  failed++;
                }
                resolveDelete();
              });
            });
          }
        } catch (err) {
          console.error(`❌ Post ID ${row.id}: Erro -`, err.message);
          failed++;
        }
      }

      console.log(`\n📊 Resumo:`);
      console.log(`✅ Atualizados: ${updated}`);
      console.log(`❌ Deletados (imagem falhou): ${failed}`);

      db.close(() => {
        console.log("\n✅ Conclusão!");
        resolve();
      });
    });
  });
}

downloadMissingImages();
