const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('./database.db');

console.log('🧹 Limpando posts COM DESCRIÇÃO VAZIA...\n');

try {
  // 1. Deletar posts inválidos
  const deleteStmt = db.prepare(`
    DELETE FROM posts 
    WHERE 
      content IS NULL OR 
      content = '' OR 
      content = '(Sem descrição)' OR
      LENGTH(content) < 20 OR
      content LIKE '%(Sem descrição)%'
  `);

  const result = deleteStmt.run();
  console.log(`✅ ${result.changes} posts com conteúdo inválido foram deletados`);

  // 2. Contar posts restantes
  const total = db.prepare("SELECT COUNT(*) as total FROM posts").get();
  console.log(`\n📊 Total de posts válidos restantes: ${total.total}`);

  // 3. Listar posts restantes
  const rows = db.prepare(`
    SELECT id, title, LENGTH(content) as content_length 
    FROM posts 
    ORDER BY id DESC 
    LIMIT 15
  `).all();

  console.log('\n📋 Posts restantes (mostrando tamanho do conteúdo):');

  rows.forEach(row => {
    const status = row.content_length > 50 ? '✅ BOM' : '⚠️ CURTO';
    console.log(`  ${status} ID ${row.id}: "${row.title.substring(0, 40)}..." (${row.content_length} chars)`);
  });

  console.log('\n✅ Limpeza concluída!');

} catch (err) {
  console.error('❌ Erro:', err.message);
} finally {
  db.close();
}