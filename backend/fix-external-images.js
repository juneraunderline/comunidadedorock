const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { downloadImage } = require('./image-downloader');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Pega todos os posts com URLs externas
db.all("SELECT id, title, image FROM posts WHERE image LIKE 'http%'", [], async (err, rows) => {
  if (err) {
    console.error('❌ Erro ao buscar posts:', err.message);
    db.close();
    return;
  }
  
  console.log(`\n🔄 Encontrados ${rows.length} posts com imagens externas\n`);
  
  if (rows.length === 0) {
    console.log('✅ Nenhuma imagem externa para processar!');
    db.close();
    return;
  }
  
  let processos = 0;
  for (const post of rows) {
    console.log(`[${processos + 1}/${rows.length}] Baixando: ${post.title.substring(0, 50)}...`);
    console.log(`                    URL: ${post.image}`);
    
    try {
      const localUrl = await downloadImage(post.image);
      if (localUrl) {
        console.log(`✅ Salvo como: ${localUrl}\n`);
        
        // Atualizar no banco de dados
        db.run("UPDATE posts SET image = ? WHERE id = ?", [localUrl, post.id], (err) => {
          if (err) {
            console.error(`❌ Erro ao atualizar post ${post.id}:`, err.message);
          } else {
            console.log(`✅ Banco de dados atualizado para post ${post.id}\n`);
          }
        });
      } else {
        console.log(`⚠️  Falhou ao baixar\n`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar: ${error.message}\n`);
    }
    
    processos++;
  }
  
  // Fechar depois de um tempo
  setTimeout(() => {
    console.log('\n✅ Processo concluído!');
    db.close();
  }, 10000);
});
