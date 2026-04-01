const Database = require("better-sqlite3");

const db = new Database("RSS.db");

try {
  console.log("🔧 Atualizando imagens...\n");

  // Atualizar
  const update = db.prepare("UPDATE posts SET image = '' WHERE id IN (18, 19)");
  const result = update.run();

  console.log(`✅ Linhas afetadas: ${result.changes}`);

  // Consultar depois da atualização
  const rows = db.prepare("SELECT id, image FROM posts WHERE id IN (18, 19)").all();

  console.log("📊 Updated rows:");
  console.log(rows);

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}