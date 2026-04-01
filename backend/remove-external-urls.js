const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

console.log("🗑️ Deletando posts com URLs externas...\n");

try {
  // 1. Buscar posts com imagem externa
  const rows = db.prepare(`
    SELECT id, title, image 
    FROM posts 
    WHERE image LIKE 'http%'
  `).all();

  if (!rows || rows.length === 0) {
    console.log("✅ Nenhum post com URL externa");
  } else {
    console.log(`Encontrados ${rows.length} posts com URLs externas:\n`);

    rows.forEach(r => {
      console.log(`  ID ${r.id}: ${r.title.substring(0, 50)}`);
    });

    // 2. Deletar cada um
    const deleteStmt = db.prepare("DELETE FROM posts WHERE id = ?");

    let deleted = 0;

    rows.forEach(row => {
      const result = deleteStmt.run(row.id);

      if (result.changes > 0) {
        deleted++;
        console.log(`✅ Deletado ID ${row.id}`);
      }
    });

    console.log(`\n✅ Total deletados: ${deleted}`);
  }

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}