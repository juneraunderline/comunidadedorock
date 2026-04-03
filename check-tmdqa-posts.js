const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, title, image, source, created_at FROM posts WHERE source = 'TMDQA!' ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error('❌ Erro ao buscar posts:', err.message);
    db.close();
    return;
  }
  
  console.log(`\n📰 Posts do TMDQA! (${rows.length} encontrados):\n`);
  
  rows.forEach((post, idx) => {
    console.log(`[${idx + 1}] ID: ${post.id}`);
    console.log(`    Título: ${post.title.substring(0, 60)}...`);
    console.log(`    Imagem: ${post.image}`);
    console.log(`    Data: ${post.created_at}\n`);
  });
  
  db.close();
});
