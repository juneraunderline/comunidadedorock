const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "database.db"));

console.log('🧹 Iniciando limpeza de posts...\n');

try {
  // 1. Deletar posts sem título
  const deleteTitle = db.prepare(`
    DELETE FROM posts 
    WHERE title IS NULL 
      OR title = '' 
      OR title = 'Sem título'
  `);
  const resTitle = deleteTitle.run();

  console.log(`✅ ${resTitle.changes} posts com title NULL/vazio foram deletados`);

  // 2. Deletar posts sem conteúdo
  const deleteContent = db.prepare(`
    DELETE FROM posts 
    WHERE content IS NULL 
      OR content = '' 
      OR content = '(Sem descrição)'
  `);
  const resContent = deleteContent.run();

  console.log(`✅ ${resContent.changes} posts com content NULL/vazio foram deletados`);

  // 3. Contar total restante
  const totalRow = db.prepare("SELECT COUNT(*) as total FROM posts").get();
  console.log(`\n📊 Total de posts após limpeza: ${totalRow.total}`);

  // 4. Listar últimos 5 posts
  const rows = db.prepare(`
    SELECT id, title, LENGTH(content) as content_length 
    FROM posts 
    ORDER BY id DESC 
    LIMIT 5
  `).all();

  console.log('\n📋 Últimos 5 posts:');
  rows.forEach(row => {
    const titlePreview = row.title ? row.title.substring(0, 50) : 'Sem título';
    console.log(`  ID ${row.id}: "${titlePreview}..." (${row.content_length} chars de conteúdo)`);
  });

  console.log('\n✅ Limpeza concluída!');

} catch (err) {
  console.error('❌ Erro:', err.message);
} finally {
  db.close();
}