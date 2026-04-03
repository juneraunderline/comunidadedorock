const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

console.log("🗑️ Deletando posts com URLs externas...\n");

db.all("SELECT id, title, image FROM posts WHERE image LIKE 'http%'", [], (err, rows) => {
  if (!rows || rows.length === 0) {
    console.log("✅ Nenhum post com URL externa");
    db.close();
    return;
  }

  console.log(`Encontrados ${rows.length} posts com URLs externas:\n`);
  rows.forEach(r => console.log(`  ID ${r.id}: ${r.title.substring(0, 50)}`));

  let deleted = 0;
  rows.forEach(row => {
    db.run("DELETE FROM posts WHERE id = ?", [row.id], function(err) {
      deleted++;
      if (!err) console.log(`✅ Deletado ID ${row.id}`);
      if (deleted === rows.length) {
        db.close();
      }
    });
  });
});
