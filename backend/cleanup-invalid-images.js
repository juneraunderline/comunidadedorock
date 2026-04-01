const Database = require('better-sqlite3');

const db = new Database('./database.db');

console.log('🧹 Limpando posts COM IMAGEM INVÁLIDA...\n');

try {
  // 1. Deletar posts com imagem inválida
  const deleteStmt = db.prepare(`
    DELETE FROM posts WHERE 
      image IS NULL OR 
      image = '' OR
      image NOT LIKE 'http%'
  `);

  const result = deleteStmt.run();
  console.log(`✅ ${result.changes} posts com imagem inválida foram deletados`);

  // 2. Contar posts restantes
  const total = db.prepare("SELECT COUNT(*) as total FROM posts").get();
  console.log(`\n📊 Total de posts COM IMAGEM VÁLIDA: ${total.total}`);

  // 3. Listar posts restantes
  const rows = db.prepare(`
    SELECT id, title, 
      CASE 
        WHEN image LIKE 'http%' THEN '✅ VÁLIDA'
        ELSE '❌ INVÁLIDA'
      END as image_status
    FROM posts 
    ORDER BY id DESC 
    LIMIT 20
  `).all();

  console.log('\n📋 Posts com status de imagem:');

  rows.forEach(row => {
    console.log(`  ${row.image_status} ID ${row.id}: "${row.title.substring(0, 40)}..."`);
  });

  console.log('\n✅ Limpeza concluída!');

} catch (err) {
  console.error('❌ Erro:', err.message);
} finally {
  db.close();
}