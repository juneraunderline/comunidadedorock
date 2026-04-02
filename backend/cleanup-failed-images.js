const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

const failedIds = [21, 28, 46, 47];

console.log("🗑️ Deletando posts com imagens que falharam...\n");

try {
  const stmt = db.prepare("DELETE FROM posts WHERE id = ?");
  
  let deleted = 0;

  failedIds.forEach((id) => {
    const result = stmt.run(id);

    if (result.changes > 0) {
      deleted++;
      console.log(`✅ Post ID ${id} deletado`);
    } else {
      console.log(`⚠️ Post ID ${id} não encontrado`);
    }
  

  console.log(`\n✅ Deletados ${deleted} posts com imagens inválidas`);

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}