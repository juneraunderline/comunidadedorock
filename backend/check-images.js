const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('./database.db');

try {
  const rows = db.prepare(`
    SELECT id, title, image 
    FROM posts 
    LIMIT 10
  `).all();

  console.log('📊 Imagens encontradas:\n');

  rows.forEach(row => {
    console.log(`ID ${row.id}: ${row.title.substring(0, 40)}...`);
    console.log(`  Imagem: ${row.image.substring(0, 100)}...`);
    console.log();
  });

} catch (err) {
  console.error('Erro:', err);
} finally {
  db.close();
}