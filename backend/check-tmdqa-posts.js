const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

try {
  const rows = db.prepare(`
    SELECT id, title, image, source, created_at 
    FROM posts 
    WHERE source = 'TMDQA!' 
    ORDER BY created_at DESC 
    LIMIT 10
  `).all();

  console.log(`\n📰 Posts do TMDQA! (${rows.length} encontrados):\n`);

  rows.forEach((post, idx) => {
    console.log(`[${idx + 1}] ID: ${post.id}`);
    console.log(`    Título: ${post.title.substring(0, 60)}...`);
    console.log(`    Imagem: ${post.image}`);
    console.log(`    Data: ${post.created_at}\n`);
  

} catch (err) {
  console.error('❌ Erro ao buscar posts:', err.message);
} finally {
  db.close();
}