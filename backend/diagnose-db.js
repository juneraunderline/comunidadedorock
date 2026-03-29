const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

console.log("📋 DIAGNÓSTICO FINAL - Estado atual do banco de dados\n");
console.log("==================================================\n");

db.all("SELECT id, title, image, source FROM posts ORDER BY id DESC", [], (err, rows) => {
  if (err) {
    console.error("Erro:", err.message);
    db.close();
    return;
  }

  console.log(`Total de posts: ${rows.length}\n`);

  console.log("📊 Distribuição de imagens:\n");
  const localCount = rows.filter(r => r.image && r.image.startsWith('/images')).length;
  const externalCount = rows.filter(r => r.image && r.image.startsWith('http')).length;
  const nullCount = rows.filter(r => !r.image).length;

  console.log(`  ✅ Com imagens locais: ${localCount}`);
  console.log(`  🌐 Com URLs externas: ${externalCount}`);
  console.log(`  ❌ Sem imagem: ${nullCount}`);

  console.log(`\n📝 Últimos 5 posts:\n`);
  rows.slice(0, 5).forEach((r, idx) => {
    console.log(`  ${idx + 1}. ID ${r.id}: "${r.title.substring(0, 40)}..."`);
    console.log(`     Source: ${r.source || "NULL"}`);
    console.log(`     Image: ${r.image ? "✅ " + r.image.substring(0, 50) : "❌ NULL"}`);
    console.log("");
  });

  console.log(`\n🔍 Posts por fonte:\n`);
  const grouped = {};
  rows.forEach(r => {
    const source = r.source || "Desconhecida";
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(r);
  });

  Object.entries(grouped).forEach(([source, posts]) => {
    const withImage = posts.filter(p => p.image).length;
    console.log(`  ${source}: ${posts.length} posts (${withImage} com imagem)`);
  });

  db.close();
});
