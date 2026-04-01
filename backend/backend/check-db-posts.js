const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

console.log("📊 VERIFICAÇÃO DOS POSTS NO BANCO\n");
console.log("==================================================\n");

db.all("SELECT id, title, source, image FROM posts ORDER BY id DESC LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error("Erro:", err.message);
    db.close();
    return;
  }

  console.log("Últimos 5 posts:\n");
  
  rows.forEach((row) => {
    console.log(`ID: ${row.id}`);
    console.log(`Título: ${row.title.substring(0, 50)}`);
    console.log(`Source: ${row.source || "NULL"}`);
    console.log(`Image: ${row.image || "NULL"}`);
    console.log("");
  });

  db.get("SELECT COUNT(*) as total FROM posts", [], (err, row) => {
    console.log(`Total de posts no banco: ${row.total}`);
    
    db.get("SELECT COUNT(*) as local FROM posts WHERE image LIKE '/images%'", [], (err, row) => {
      console.log(`Posts com imagens locais: ${row.local}`);
      
      db.get("SELECT COUNT(*) as external FROM posts WHERE image LIKE 'http%'", [], (err, row) => {
        console.log(`Posts com imagens externas: ${row.external}`);
        db.close();
      });
    });
  });
});
