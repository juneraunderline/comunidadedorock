const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('🧹 Limpando posts COM DESCRIÇÃO VAZIA...\n');

db.serialize(() => {
  // 1. Deletar posts com conteúdo vazio, nulo ou genérico
  db.run(`DELETE FROM posts WHERE 
    content IS NULL OR 
    content = '' OR 
    content = '(Sem descrição)' OR
    LENGTH(content) < 20 OR
    content LIKE '%(Sem descrição)%'`, function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts:', err);
    } else {
      console.log(`✅ ${this.changes} posts com conteúdo inválido foram deletados`);
    }
  });

  // 2. Contar posts restantes
  setTimeout(() => {
    db.all("SELECT COUNT(*) as total FROM posts", [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao contar posts:', err);
      } else {
        console.log(`\n📊 Total de posts válidos restantes: ${rows[0].total}`);
      }
      
      // 3. Listar posts restantes
      db.all("SELECT id, title, LENGTH(content) as content_length FROM posts ORDER BY id DESC LIMIT 15", [], (err, rows) => {
        if (err) {
          console.error('❌ Erro ao listar posts:', err);
        } else {
          console.log('\n📋 Posts restantes (mostrando tamanho do conteúdo):');
          rows.forEach(row => {
            const status = row.content_length > 50 ? '✅ BOM' : '⚠️ CURTO';
            console.log(`  ${status} ID ${row.id}: "${row.title.substring(0, 40)}..." (${row.content_length} chars)`);
          });
        }
        
        console.log('\n✅ Limpeza concluída!');
        db.close();
      });
    });
  }, 500);
});
