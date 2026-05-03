const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('🧹 Iniciando limpeza de posts...\n');

db.serialize(() => {
  // 1. Deletar posts com title null ou vazio
  db.run("DELETE FROM posts WHERE title IS NULL OR title = '' OR title = 'Sem título'", function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts sem título:', err);
    } else {
      console.log(`✅ ${this.changes} posts com title NULL/vazio foram deletados`);
    }
  });

  // 2. Deletar posts com content null ou vazio
  db.run("DELETE FROM posts WHERE content IS NULL OR content = '' OR content = '(Sem descrição)'", function(err) {
    if (err) {
      console.error('❌ Erro ao deletar posts sem conteúdo:', err);
    } else {
      console.log(`✅ ${this.changes} posts com content NULL/vazio foram deletados`);
    }
  });

  // 3. Deletar posts duplicados por título (mantendo o mais recente)
  db.run(`
    DELETE FROM posts 
    WHERE id NOT IN (
      SELECT MAX(id) 
      FROM posts 
      GROUP BY LOWER(TRIM(title))
    )
  `, function(err) {
    if (err) {
      console.error('❌ Erro ao deletar duplicatas:', err);
    } else {
      console.log(`✅ ${this.changes} posts duplicados por título foram deletados`);
    }
  });

  // 4. Contar posts restantes
  db.all("SELECT COUNT(*) as total FROM posts", [], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao contar posts:', err);
    } else {
      console.log(`\n📊 Total de posts após limpeza: ${rows[0].total}`);
    }
    
    // 4. Listar posts restantes para verificação
    db.all("SELECT id, title, LENGTH(content) as content_length FROM posts ORDER BY id DESC LIMIT 5", [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao listar posts:', err);
      } else {
        console.log('\n📋 Últimos 5 posts:');
        rows.forEach(row => {
          console.log(`  ID ${row.id}: "${row.title.substring(0, 50)}..." (${row.content_length} chars de conteúdo)`);
        });
      }
      
      console.log('\n✅ Limpeza concluída!');
      db.close();
    });
  });
});
