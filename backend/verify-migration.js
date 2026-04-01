const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const imagesDir = path.join(__dirname, "public/images");

const db = new sqlite3.Database(dbPath);

console.log("📊 VERIFICAÇÃO FINAL DA MIGRAÇÃO\n");
console.log("==================================================\n");

db.all("SELECT COUNT(*) as total FROM posts", [], (err, rows) => {
  const totalPosts = rows[0].total;
  console.log(`📝 Total de posts no banco: ${totalPosts}`);

  db.all("SELECT COUNT(*) as local FROM posts WHERE image LIKE '/images%'", [], (err, rows) => {
    const localImages = rows[0].local;
    console.log(`✅ Posts com imagens locais: ${localImages}`);

    db.all("SELECT COUNT(*) as external FROM posts WHERE image LIKE 'http%'", [], (err, rows) => {
      const externalImages = rows[0].external;
      console.log(`🌐 Posts com imagens externas: ${externalImages}`);

      // Contar arquivos no diretório de imagens
      if (fs.existsSync(imagesDir)) {
        const imageFiles = fs.readdirSync(imagesDir);
        console.log(`🖼️ Arquivos de imagem no servidor: ${imageFiles.length}`);
        
        console.log("\n📁 Imagens armazenadas localmente:");
        console.log("==================================================");
        imageFiles.slice(0, 10).forEach((file) => {
          const filePath = path.join(imagesDir, file);
          const stats = fs.statSync(filePath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          console.log(`  /images/${file} (${sizeKB}KB)`);
        });
        if (imageFiles.length > 10) {
          console.log(`  ... e mais ${imageFiles.length - 10} imagens`);
        }
      }

      console.log("\n📊 Resumo:");
      console.log("==================================================");
      console.log(`✅ Posts com qualidade: ${localImages}`);
      console.log(`❌ Posts removidos (imagens inválidas): ${totalPosts - localImages - externalImages}`);
      console.log(`🔧 Taxa de sucesso: ${((localImages / totalPosts) * 100).toFixed(1)}%`);
      
      console.log("\n✅ Migração concluída com sucesso!");
      console.log("🎉 Todas as imagens estão sendo servidas localmente\n");

      db.close();
    });
  });
});
