const axios = require("axios");

async function testImageLoading() {
  console.log("🖼️ TESTANDO CARREGAMENTO DE IMAGENS\n");
  console.log("==================================================\n");

  try {
    // 1. Verificar se a API retorna os posts com imagens
    console.log("1️⃣ Testando /api/posts...");
    const postsResponse = await axios.get("http://localhost:3000/api/posts");
    const posts = postsResponse.data;
    
    console.log(`   ✅ Retornou ${posts.length} posts`);
    
    // Pegar primeiro post com imagem local
    const postWithImage = posts.find(p => p.image && p.image.startsWith('/images'));
    
    if (postWithImage) {
      console.log(`   ✅ Post com imagem local encontrado:`);
      console.log(`      ID: ${postWithImage.id}`);
      console.log(`      Título: ${postWithImage.title.substring(0, 40)}...`);
      console.log(`      Imagem: ${postWithImage.image}`);
      console.log(`      Source: ${postWithImage.source || "N/A"}`);
      
      // 2. Verificar se a imagem está acessível
      console.log(`\n2️⃣ Testando acesso à imagem...`);
      const imageUrl = `http://localhost:3000${postWithImage.image}`;
      console.log(`   URL: ${imageUrl}`);
      
      try {
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        console.log(`   ✅ Imagem acessível (${imageResponse.data.length} bytes)`);
        console.log(`   ✅ Content-Type: ${imageResponse.headers['content-type']}`);
      } catch (imgErr) {
        console.error(`   ❌ Erro ao acessar imagem: ${imgErr.message}`);
      }
    } else {
      console.log(`   ⚠️ Nenhum post com imagem local encontrado`);
      
      // Listar posts com URLs externas
      const externalPosts = posts.filter(p => p.image && p.image.startsWith('http'));
      if (externalPosts.length > 0) {
        console.log(`   ℹ️ ${externalPosts.length} posts com URLs externas:`);
        externalPosts.slice(0, 3).forEach(p => {
          console.log(`      - ${p.title.substring(0, 40)}...`);
        });
      }
    }
    
    // 3. Verificar se há posts sem imagem
    const postsWithoutImage = posts.filter(p => !p.image);
    if (postsWithoutImage.length > 0) {
      console.log(`\n3️⃣ Posts sem imagem: ${postsWithoutImage.length}`);
      postsWithoutImage.forEach(p => {
        console.log(`   - ID ${p.id}: ${p.title.substring(0, 30)}...`);
      });
    }
    
    // 4. Resumo geral
    console.log(`\n📊 RESUMO`);
    console.log("==================================================");
    const localImages = posts.filter(p => p.image && p.image.startsWith('/images')).length;
    const externalImages = posts.filter(p => p.image && p.image.startsWith('http')).length;
    const noImages = posts.filter(p => !p.image).length;
    
    console.log(`✅ Posts com imagens locais: ${localImages}`);
    console.log(`🌐 Posts com URLs externas: ${externalImages}`);
    console.log(`❌ Posts sem imagem: ${noImages}`);
    console.log(`📝 Total de posts: ${posts.length}`);
    
  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
}

testImageLoading();
