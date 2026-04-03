const Database = require("better-sqlite3");

const db = new Database("./database.db");

console.log("🧹 Limpando posts SEM IMAGEM...\n");

try {
  // 1. Deletar posts com image NULL ou vazio
  const deleteStmt = db.prepare(`
    DELETE FROM posts 
    WHERE image IS NULL OR image = ''
  `);

  const result = deleteStmt.run();
  console.log(`✅ ${result.changes} posts sem imagem foram deletados`);

  // 2. Contar posts restantes
  const total = db.prepare("SELECT COUNT(*) as total FROM posts").get().total;
  console.log(`\n📊 Total de posts COM IMAGEM: ${total}`);

  // 3. Listar posts restantes
  const rows = db.prepare(`
    SELECT id, title, image 
    FROM posts 
    ORDER BY id DESC 
    LIMIT 10
  `).all();

  console.log("\n📋 Primeiros 10 posts restantes:");
  rows.forEach(row => {
    const hasImage = row.image ? "✅" : "❌";
    console.log(`  ${hasImage} ID ${row.id}: "${row.title.substring(0, 45)}..."`);
  });

  console.log("\n🎉 Limpeza concluída!");

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}