const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('🔍 Verificando posts sem imagem...\n');

db.serialize(() => {
  // Listar todos os posts com detalhes
  db.all(`SELECT id, title, 
          CASE 
            WHEN image IS NULL THEN 'NULL'
            WHEN image = '' THEN 'VAZIO'
            WHEN image NOT LIKE 'http%' THEN 'INVÁLIDO: ' || image
            ELSE 'OK: ' || SUBSTR(image, 1, 50)
          END as image_status
          FROM posts ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      console.error('❌ Erro:', err);
      return db.close();
    }
    
    console.log(`📊 Total de posts: ${rows.length}\n`);
    console.log('Posts encontrados:');
    rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.title.substring(0, 40)}...`);
      console.log(`    └─ Imagem: ${row.image_status}\n`);
    });
    
    // Agora deletar posts sem imagem válida
    console.log('\n🗑️  Deletando posts sem imagem válida...\n');
    db.run(`DELETE FROM posts WHERE 
      image IS NULL OR 
      image = '' OR 
      image NOT LIKE 'http%'`, function(err) {
      if (err) {
        console.error('❌ Erro ao deletar:', err);
      } else {
        console.log(`✅ ${this.changes} posts SEM IMAGEM VÁLIDA foram deletados\n`);
        
        // Contar restantes
        db.all("SELECT COUNT(*) as total FROM posts", [], (err, result) => {
          console.log(`📊 Posts restantes COM IMAGEM: ${result[0].total}`);
          
          // Listar os restantes
          db.all(`SELECT id, title FROM posts ORDER BY id DESC LIMIT 10`, [], (err, remaining) => {
            console.log('\n✅ Posts restantes:');
            remaining.forEach(p => {
              console.log(`  ID ${p.id}: ${p.title.substring(0, 50)}...`);
            });
            
            console.log('\n✅ Limpeza finalizada!');
            db.close();
          });
        });
      }
    });
  });
});
