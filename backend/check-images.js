const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

db.all(`SELECT id, title, image FROM posts LIMIT 10`, [], (err, rows) => {
  if (err) {
    console.error('Erro:', err);
    return db.close();
  }
  
  console.log('📊 Imagens encontradas:\n');
  rows.forEach(row => {
    console.log(`ID ${row.id}: ${row.title.substring(0, 40)}...`);
    console.log(`  Imagem: ${row.image.substring(0, 100)}...`);
    console.log();
  });
  
  db.close();
});
