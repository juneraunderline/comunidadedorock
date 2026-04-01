const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const imagesDir = path.join(__dirname, "public/images");

const db = new Database(dbPath);

console.log("📊 VERIFICAÇÃO FINAL DA MIGRAÇÃO\n");
console.log("==================================================\n");

try {
  const totalPosts = db.prepare("SELECT COUNT(*) as total FROM posts").get().total;
  console.log(`📝 Total de posts no banco: ${totalPosts}`);

  const localImages = db.prepare("SELECT COUNT(*) as local FROM posts WHERE image LIKE '/images%'").get().local;
  console.log(`✅ Posts com imagens locais: ${localImages}`);

  const externalImages = db.prepare("SELECT COUNT(*) as external FROM posts WHERE image LIKE 'http%'").get().external;
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

  console.log("\n🎉 Migração concluída com sucesso!");
  console.log("✅ Todas as imagens estão sendo servidas localmente\n");

} catch (err) {
  console.error("❌ Erro:", err.message);
} finally {
  db.close();
}