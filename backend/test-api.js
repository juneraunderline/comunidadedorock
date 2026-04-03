const http = require('http');

http.get('http://localhost:3000/api/posts', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const posts = JSON.parse(data);
    console.log('Total de posts:', posts.length);
    console.log('\nPrimeiros 5:\n');
    posts.slice(0, 5).forEach(p => {
      console.log(`- ${p.title.substring(0, 50)}... [${p.source}]`);
    });
    
    const external = posts.filter(p => p.image && p.image.startsWith('https'));
    const local = posts.filter(p => p.image && p.image.startsWith('http://localhost'));
    
    console.log(`\n📊 Resumo:\n✅ URLs locais: ${local.length}\n⚠️  URLs externas: ${external.length}`);
    
    if (external.length > 0) {
      console.log('\n⚠️  URLs externas encontradas:');
      external.forEach(p => console.log(`   - ${p.image}`));
    }
  });
});
