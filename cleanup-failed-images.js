const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

const failedIds = [21, 28, 46, 47];

console.log("🗑️ Deletando posts com imagens que falharam...\n");

let deleted = 0;

failedIds.forEach((id) => {
  db.run("DELETE FROM posts WHERE id = ?", [id], function(err) {
    if (err) {
      console.error(`❌ Post ID ${id}: Erro ao deletar -`, err.message);
    } else {
      deleted++;
      console.log(`✅ Post ID ${id} deletado`);
    }

    if (deleted === failedIds.length) {
      console.log(`\n✅ Deletados ${deleted} posts com imagens inválidas`);
      db.close();
    }
  });
});
