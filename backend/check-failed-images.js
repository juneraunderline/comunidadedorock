const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

try {
  const rows = db.prepare(`
    SELECT id, title, image 
    FROM posts 
    WHERE image LIKE 'http%' 
    ORDER BY id
  `).all();

  console.log("Posts com imagens externas (não foram migrados):");
  console.log("==================================================\n");

  rows.forEach((row) => {
    console.log(`ID: ${row.id}`);
    console.log(`Título: ${row.title.substring(0, 60)}...`);
    console.log(`URL: ${row.image}`);
    console.log("");
  

  console.log(`Total: ${rows.length} posts`);

} catch (err) {
  console.error("Erro:", err.message);
} finally {
  db.close();
}