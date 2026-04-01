const fs = require("fs");
const path = require("path");
const axios = require("axios");

async function verifyAllImages() {
  console.log("🖼️ VERIFICAÇÃO COMPLETA DE IMAGENS\n");
  console.log("==================================================\n");

  const imagesDir = path.join(__dirname, "public/images");

  // 1. Listar arquivos no diretório
  console.log("1️⃣ Arquivos no servidor:\n");
  let files = [];
  try {
    files = fs.readdirSync(imagesDir);
    console.log(`   ✅ Total de arquivos: ${files.length}`);
    files.slice(0, 5).forEach(file => {
      const filePath = path.join(imagesDir, file);
      const stats = fs.statSync(filePath);
      console.log(`      - ${file} (${(stats.size / 1024).toFixed(2)}KB)`);
    });
    if (files.length > 5) {
      console.log(`      ... e mais ${files.length - 5} arquivos`);
    }
  } catch (err) {
    console.error(`   ❌ Erro ao listar arquivos: ${err.message}`);
  }

  // 2. Obter posts da API
  console.log("\n2️⃣ Posts retornados pela API:\n");
  let posts = [];
  try {
    const response = await axios.get("http://localhost:3000/api/posts");
    posts = response.data;
    console.log(`   ✅ Total de posts: ${posts.length}`);

    // Agrupar por source
    const bySource = {};
    posts.forEach(p => {
      const source = p.source || "Desconhecida";
      if (!bySource[source]) bySource[source] = 0;
      bySource[source]++;
    });

    console.log("\n   📊 Posts por fonte:");
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count} posts`);
    });
  } catch (err) {
    console.error(`   ❌ Erro ao buscar posts: ${err.message}`);
  }

  // 3. Testar acesso a cada imagem via HTTP
  console.log("\n3️⃣ Testando acesso às imagens via HTTP:\n");
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < Math.min(5, posts.length); i++) {
    const post = posts[i];
    try {
      const imageUrl = `http://localhost:3000${post.image}`;
      const response = await axios.get(imageUrl, { timeout: 5000 });
      console.log(`   ✅ POST ID ${post.id}: ${response.status} - ${(response.data.length / 1024).toFixed(2)}KB`);
      successCount++;
    } catch (err) {
      console.log(`   ❌ POST ID ${post.id}: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n📊 RESUMO FINAL\n");
  console.log("==================================================");
  console.log(`✅ Arquivos no disco: ${files.length}`);
  console.log(`📝 Posts no banco: ${posts.length}`);
  console.log(`✅ Imagens terst acessíveis: ${successCount}/${Math.min(5, posts.length)}`);
  console.log(`📍 Caminho das imagens: /images/{nome}.ext`);
  console.log(`🔗 URL base: http://localhost:3000/images/`);
}

verifyAllImages();
