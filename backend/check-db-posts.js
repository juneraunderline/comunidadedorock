const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

console.log("📊 VERIFICAÇÃO DOS POSTS NO BANCO\n");
console.log("==================================================\n");

try {
  const rows = db.prepare(`
    SELECT id, title, source, image 
    FROM posts 
    ORDER BY id DESC 
    LIMIT 5
  `).all();

  console.log("Últimos 5 posts:\n");

  rows.forEach((row) => {
    console.log(`ID: ${row.id}`);
    console.log(`Título: ${row.title.substring(0, 50)}`);
    console.log(`Source: ${row.source || "NULL"}`);
    console.log(`Image: ${row.image || "NULL"}`);
    console.log("");
  });

  const total = db.prepare("SELECT COUNT(*) as total FROM posts").get();
  console.log(`Total de posts no banco: ${total.total}`);

  const local = db.prepare("SELECT COUNT(*) as local FROM posts WHERE image LIKE '/images%'").get();
  console.log(`Posts com imagens locais: ${local.local}`);

  const external = db.prepare("SELECT COUNT(*) as external FROM posts WHERE image LIKE 'http%'").get();
  console.log(`Posts com imagens externas: ${external.external}`);

} catch (err) {
  console.error("Erro:", err.message);
} finally {
  db.close();
}