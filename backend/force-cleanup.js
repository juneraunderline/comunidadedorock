const Database = require("better-sqlite3");

const db = new Database("./database.db");

console.log("🔍 Verificando posts sem imagem...\n");

try {
  // Listar todos os posts com status da imagem
  const rows = db.prepare(`
    SELECT id, title, 
    CASE 
      WHEN image IS NULL THEN 'NULL'
      WHEN image = '' THEN 'VAZIO'
      WHEN image NOT LIKE 'http%' THEN 'INVÁLIDO: ' || image
      ELSE 'OK: ' || SUBSTR(image, 1, 50)
    END as image_status
    FROM posts ORDER BY id DESC
  `).all();

  console.log(`📊 Total de posts: ${rows.length}\n`);
  console.log("Posts encontrados:");

  rows.forEach(row => {
    console.log(`  ID ${row.id}: ${row.title.substring(0, 40)}...`);
    console.log(`    └─ Imagem: ${row.image_status}\n`);
  });

  // Deletar posts sem imagem válida
  console.log("\n🗑️ Deletando posts sem imagem válida...\n");

  const deleteStmt = db.prepare(`
    DELETE FROM posts 
    WHERE 
      image IS NULL OR 
      image = '' OR 
      image NOT LIKE 'http%'
  `);

  const result = deleteStmt.run();

  console.log(`✅ ${result.changes} posts SEM IMAGEM VÁLIDA foram deletados\n`);

  // Contar restantes
  const totalRemaining = db.prepare("SELECT COUNT(*) as total FROM posts").get().total;
  console.log(`📊 Posts restantes COM IMAGEM: ${totalRemaining}`);

  // Listar os restantes
  const remaining = db.prepare(`
    SELECT id, title FROM posts 
    ORDER BY id DESC 
    LIMIT 10
  `).all();

  console.log("\n✅ Posts restantes:");
  remaining.forEach(p => {
    console.log(`  ID ${p.id}: ${p.title.substring(0, 50)}...`);
  });

  console.log("\n🎉 Limpeza finalizada!");

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}