const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

try {
  console.log("🗑️ Deletando posts (IDs 76, 77)...\n");

  // Deletar posts
  const deleteStmt = db.prepare("DELETE FROM posts WHERE id IN (76, 77)");
  const result = deleteStmt.run();

  console.log(`✅ Deletados ${result.changes} posts (IDs 76, 77)`);

  // Contar restantes
  const row = db.prepare("SELECT COUNT(*) as count FROM posts").get();
  console.log(`✅ Total de posts restantes: ${row.count}`);

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}