const axios = require('axios');

const API_URL = 'http://localhost:3000/api/posts';
const BACKEND_URL = 'http://localhost:3000';

async function verifyImages() {
  try {
    console.log('🔍 Fetching posts from API...\n');
    const response = await axios.get(API_URL);
    const posts = response.data;

    console.log(`✅ Total de posts: ${posts.length}\n`);

    let imageCount = 0;
    let localImagesCount = 0;
    let externalImagesCount = 0;
    let noImageCount = 0;

    posts.forEach((post, index) => {
      const hasImage = !!post.image;
      const isLocal = post.image && post.image.startsWith('/images/');
      const isExternal = post.image && !post.image.startsWith('/images/');

      if (hasImage) imageCount++;
      if (isLocal) localImagesCount++;
      if (isExternal) externalImagesCount++;
      if (!hasImage) noImageCount++;

      console.log(`[${index + 1}] ID: ${post.id} | Título: ${post.title.substring(0, 50)}...`);
      console.log(`    Imagem: ${post.image || 'SEM IMAGEM'}`);
      console.log(`    Fonte: ${post.source || 'SEM FONTE'}`);
      console.log('');
    });

    console.log('📊 RESUMO:');
    console.log(`✅ Posts com imagem: ${imageCount}/${posts.length}`);
    console.log(`✅ Posts com imagem local: ${localImagesCount}/${posts.length}`);
    console.log(`⚠️  Posts com imagem externa: ${externalImagesCount}/${posts.length}`);
    console.log(`❌ Posts sem imagem: ${noImageCount}/${posts.length}`);

    if (externalImagesCount > 0) {
      console.log('\n⚠️ AVISO: Detectadas URLs externas!');
    } else {
      console.log('\n✅ Todas as imagens são locais!');
    }

    // Test image access
    console.log('\n🖼️  Testando acesso às imagens...\n');
    for (let i = 0; i < Math.min(3, posts.length); i++) {
      const post = posts[i];
      if (post.image && post.image.startsWith('/images/')) {
        const imageUrl = `${BACKEND_URL}${post.image}`;
        try {
          const imgResponse = await axios.head(imageUrl, { timeout: 3000 });
          console.log(`✅ ${post.image} - Status: ${imgResponse.status}`);
          console.log(`   CORS Headers: ${imgResponse.headers['access-control-allow-origin'] || 'NOT SET'}`);
        } catch (err) {
          console.log(`❌ ${post.image} - Erro: ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao buscar posts:', error.message);
  }
}

verifyImages();
