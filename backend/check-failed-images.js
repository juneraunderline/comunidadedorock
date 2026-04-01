const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, title, image FROM posts WHERE image LIKE 'http%' ORDER BY id", [], (err, rows) => {
  if (err) {
    console.error("Erro:", err.message);
    db.close();
    return;
  }

  console.log("Posts com imagens externas (não foram migrados):");
  console.log("==================================================\n");
  
  rows.forEach((row) => {
    console.log(`ID: ${row.id}`);
    console.log(`Título: ${row.title.substring(0, 60)}...`);
    console.log(`URL: ${row.image}`);
    console.log("");
  });

  console.log(`Total: ${rows.length} posts`);
  db.close();
});
