const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

try {
  console.log("🧹 Removendo posts com imagens externas...\n");

  // Deletar posts com image começando com http
  const deleteStmt = db.prepare("DELETE FROM posts WHERE image LIKE 'http%'");
  const result = deleteStmt.run();

  console.log(`🗑️ Deletados ${result.changes} posts com imagens externas (URLs não acessíveis)\n`);

  // Posts por source
  const rows = db.prepare(`
    SELECT source, COUNT(*) as count 
    FROM posts 
    GROUP BY source
  `).all();

  console.log('📊 Posts restantes por fonte:\n');
  rows.forEach(row => {
    console.log(`   ${row.source}: ${row.count} posts`);
  });

  // Total geral
  const totalRow = db.prepare("SELECT COUNT(*) as total FROM posts").get();
  console.log(`\n✅ Total de posts: ${totalRow.total}`);

} catch (err) {
  console.error('❌ Erro:', err.message);
} finally {
  db.close();
}