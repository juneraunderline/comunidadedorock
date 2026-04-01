const axios = require("axios");

async function testCORS() {
  console.log("🔍 Testando CORS para /images\n");

  try {
    const response = await axios.get("http://localhost:3000/images/392c04cc30dc91bc83f3503a1028af99.jpg", {
      validateStatus: () => true // Não jogar erro em nenhum status
    });

    console.log("Status:", response.status);
    console.log("\nResponse Headers:");
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase().includes('access') || key.toLowerCase().includes('cache') || key.toLowerCase().includes('content')) {
        console.log(`  ${key}: ${value}`);
      }
    });

    console.log("\n✅ Imagem carregada com sucesso");
    console.log(`Tamanho: ${response.data.length} bytes`);
  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
}

testCORS();
