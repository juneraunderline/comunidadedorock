const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Delete posts with IDs 76 and 77
  db.run("DELETE FROM posts WHERE id IN (76, 77)", function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts:', err.message);
    } else {
      console.log(`✅ Deletados ${this.changes} posts com URLs externas (IDs 76, 77)`);
    }
    
    // Show remaining posts count
    db.get("SELECT COUNT(*) as count FROM posts", (err, row) => {
      if (err) {
        console.error('❌ Erro ao contar posts:', err.message);
      } else {
        console.log(`✅ Total de posts restantes: ${row.count}`);
      }
      db.close();
    });
  });
});
