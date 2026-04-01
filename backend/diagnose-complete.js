const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function diagnose() {
  let log = "🔍 DIAGNÓSTICO COMPLETO - " + new Date().toLocaleString() + "\n";
  log += "=" .repeat(60) + "\n\n";

  try {
    // 1. Teste API
    log += "1️⃣ TESTE API - /api/posts\n";
    const apiRes = await axios.get("http://localhost:3000/api/posts");
    const posts = apiRes.data;
    log += `✅ Status: ${apiRes.status}\n`;
    log += `✅ Total de posts: ${posts.length}\n`;

    if (posts.length > 0) {
      log += `✅ Primeiro post:\n`;
      const p = posts[0];
      log += `   ID: ${p.id}\n`;
      log += `   Título: ${p.title?.substring(0, 50)}\n`;
      log += `   Fonte: ${p.source}\n`;
      log += `   Imagem: ${p.image}\n`;

      // 2. Teste imagem específica
      log += `\n2️⃣ TESTE IMAGEM - GET ${p.image}\n`;
      try {
        const imgRes = await axios.get(`http://localhost:3000${p.image}`, {
          responseType: "arraybuffer",
          timeout: 5000,
        });
        log += `✅ Status: ${imgRes.status}\n`;
        log += `✅ Tamanho: ${imgRes.data.length} bytes\n`;
        log += `✅ Content-Type: ${imgRes.headers["content-type"]}\n`;
        log += `✅ CORS Allow-Origin: ${imgRes.headers["access-control-allow-origin"]}\n`;
      } catch (imgErr) {
        log += `❌ Erro ao buscar imagem: ${imgErr.message}\n`;
        if (imgErr.response) {
          log += `   Status: ${imgErr.response.status}\n`;
        }
      }
    }

    // 3. Teste diretório de imagens
    log += `\n3️⃣ ARQUIVO DE IMAGENS - /backend/public/images\n`;
    const imagesDir = path.join(__dirname, "public/images");
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir);
      log += `✅ Diretório existe\n`;
      log += `✅ Total de arquivos: ${files.length}\n`;
      if (files.length > 0) {
        log += `Primeiros 3 arquivos:\n`;
        files.slice(0, 3).forEach((file) => {
          const filePath = path.join(imagesDir, file);
          const stats = fs.statSync(filePath);
          log += `   - ${file} (${(stats.size / 1024).toFixed(2)}KB)\n`;
        });
      }
    } else {
      log += `❌ Diretório NÃO existe\n`;
    }

    // 4. Verificar Posts-Imagens
    log += `\n4️⃣ STATUS DAS IMAGENS NA BASE DE DADOS\n`;
    const withLocal = posts.filter((p) => p.image?.startsWith("/images")).length;
    const withExternal = posts.filter((p) => p.image?.startsWith("http")).length;
    const withoutImage = posts.filter((p) => !p.image).length;

    log += `✅ Com imagens locais: ${withLocal}/${posts.length}\n`;
    log += `🌐 Com URLs externas: ${withExternal}/${posts.length}\n`;
    log += `❌ Sem imagem: ${withoutImage}/${posts.length}\n`;

  } catch (err) {
    log += `\n❌ ERRO GERAL: ${err.message}\n`;
  }

  log += `\n${"=".repeat(60)}\n`;
  log += `📊 CONCLUSÃO\n`;
  log += `${"=".repeat(60)}\n`;

  const posts2 = (await axios.get("http://localhost:3000/api/posts")).data;
  const allLocal = posts2.every((p) => p.image?.startsWith("/images"));

  if (allLocal && posts2.length > 0) {
    log += `✅ SISTEMA ESTÁ OK!\n`;
    log += `✅ Todas as imagens são locais\n`;
    log += `✅ Todas devem aparecer no navegador\n\n`;
    log += `🔧 SE NÃO APARECEM NO NAVEGADOR:\n`;
    log += `   1. Recarregue com Ctrl+Shift+R (cache)\n`;
    log += `   2. Abra DevTools (F12) e procure por erros\n`;
    log += `   3. Verifique a aba Network\n`;
  } else {
    log += `❌ PROBLEMA DETECTADO\n`;
    if (posts2.some((p) => p.image?.startsWith("http"))) {
      log += `❌ há posts com URLs externas\n`;
    }
  }

  // Escrever arquivo
  const logPath = path.join(__dirname, "DIAGNOSTICO.txt");
  fs.writeFileSync(logPath, log);
  console.log(log);
  console.log(`\n📁 Log salvo em: ${logPath}`);
}

diagnose();
