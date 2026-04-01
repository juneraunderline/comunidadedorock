const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('🧹 Limpando posts SEM IMAGEM...\n');

db.serialize(() => {
  // 1. Deletar posts com image NULL ou vazio
  db.run("DELETE FROM posts WHERE image IS NULL OR image = ''", function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts sem imagem:', err);
    } else {
      console.log(`✅ ${this.changes} posts sem imagem foram deletados`);
    }
  });

  // 2. Contar posts restantes
  setTimeout(() => {
    db.all("SELECT COUNT(*) as total FROM posts", [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao contar posts:', err);
      } else {
        console.log(`\n📊 Total de posts COM IMAGEM: ${rows[0].total}`);
      }
      
      // 3. Listar posts restantes
      db.all("SELECT id, title, image FROM posts ORDER BY id DESC LIMIT 10", [], (err, rows) => {
        if (err) {
          console.error('❌ Erro ao listar posts:', err);
        } else {
          console.log('\n📋 Primeiros 10 posts restantes:');
          rows.forEach(row => {
            const hasImage = row.image ? '✅' : '❌';
            console.log(`  ${hasImage} ID ${row.id}: "${row.title.substring(0, 45)}..."`);
          });
        }
        
        console.log('\n✅ Limpeza concluída!');
        db.close();
      });
    });
  }, 500);
});
