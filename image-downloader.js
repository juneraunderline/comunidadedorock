const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Criar pasta public/images se não existir
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('✅ Pasta public/images criada');
}

async function downloadImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    return null;
  }
  
  try {
    // Gerar nome único para a imagem baseado no MD5 da URL
    const md5 = require('crypto').createHash('md5').update(imageUrl).digest('hex');
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `${md5}${ext}`;
    const filepath = path.join(imagesDir, filename);
    
    // Se já existe, retorna o caminho local
    if (fs.existsSync(filepath)) {
      return `/images/${filename}`;
    }
    
    // Download da imagem
    return new Promise((resolve) => {
      const protocol = imageUrl.startsWith('https') ? https : http;
      const timeout = setTimeout(() => {
        console.warn(`⏱️ Timeout ao baixar: ${imageUrl.substring(0, 60)}...`);
        resolve(null);
      }, 5000);
      
      protocol.get(imageUrl, { timeout: 5000 }, (res) => {
        clearTimeout(timeout);
        
        // Verificar se é uma imagem
        const contentType = res.headers['content-type'];
        if (!contentType || !contentType.includes('image')) {
          res.resume(); // Descartar resposta
          resolve(null);
          return;
        }
        
        // Limitar tamanho (máx 2MB)
        let size = 0;
        const maxSize = 2 * 1024 * 1024;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxSize) {
            res.pause();
            res.destroy();
            resolve(null);
            return;
          }
        });
        
        const file = fs.createWriteStream(filepath, { autoClose: true });
        res.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`✅ Imagem salva: /images/${filename}`);
          resolve(`/images/${filename}`);
        });
        
        file.on('error', (err) => {
          fs.unlink(filepath, () => {});
          console.warn(`⚠️ Erro ao salvar imagem: ${err.message.substring(0, 50)}`);
          resolve(null);
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        console.warn(`⚠️ Erro ao baixar imagem: ${err.message.substring(0, 50)}`);
        resolve(null);
      });
    });
  } catch (err) {
    console.warn(`⚠️ Erro ao processar imagem: ${err.message}`);
    return null;
  }
}

module.exports = { downloadImage, imagesDir };
