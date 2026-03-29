const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('🧹 Limpando posts COM IMAGEM INVÁLIDA...\n');

db.serialize(() => {
  // 1. Deletar posts com imagem NULL, vazio ou que não começa com http
  db.run(`DELETE FROM posts WHERE 
    image IS NULL OR 
    image = '' OR
    image NOT LIKE 'http%'`, function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts:', err);
    } else {
      console.log(`✅ ${this.changes} posts com imagem inválida foram deletados`);
    }
  });

  // 2. Contar posts restantes
  setTimeout(() => {
    db.all("SELECT COUNT(*) as total FROM posts", [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao contar posts:', err);
      } else {
        console.log(`\n📊 Total de posts COM IMAGEM VÁLIDA: ${rows[0].total}`);
      }
      
      // 3. Listar posts restantes
      db.all(`SELECT id, title, 
              CASE 
                WHEN image LIKE 'http%' THEN '✅ VÁLIDA'
                ELSE '❌ INVÁLIDA'
              END as image_status
              FROM posts ORDER BY id DESC LIMIT 20`, [], (err, rows) => {
        if (err) {
          console.error('❌ Erro ao listar posts:', err);
        } else {
          console.log('\n📋 Posts com status de imagem:');
          rows.forEach(row => {
            console.log(`  ${row.image_status} ID ${row.id}: "${row.title.substring(0, 40)}..."`);
          });
        }
        
        console.log('\n✅ Limpeza concluída!');
        db.close();
      });
    });
  }, 500);
});
