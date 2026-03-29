const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Deletar todos os posts com imagens externas
db.run("DELETE FROM posts WHERE image LIKE 'http%'", function(err) {
  if (err) {
    console.error('❌ Erro ao deletar posts:', err.message);
    db.close();
    return;
  }
  
  console.log(`\n🗑️  Deletados ${this.changes} posts com imagens externas (URLs não acessíveis)\n`);
  
  // Mostrar posts restantes por source
  db.all("SELECT source, COUNT(*) as count FROM posts GROUP BY source", [], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao contar posts:', err.message);
      db.close();
      return;
    }
    
    console.log('📊 Posts restantes por fonte:\n');
    rows.forEach(row => {
      console.log(`   ${row.source}: ${row.count} posts`);
    });
    
    db.get("SELECT COUNT(*) as total FROM posts", [], (err, row) => {
      console.log(`\n✅ Total de posts: ${row.total}`);
      db.close();
    });
  });
});
