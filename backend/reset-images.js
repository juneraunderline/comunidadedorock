const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('RSS.db');

db.run("UPDATE posts SET image = '' WHERE id IN (18, 19)", () => {
  db.all("SELECT id, image FROM posts WHERE id IN (18, 19)", (err, rows) => {
    console.log('Updated rows:', rows);
    db.close();
  });
});
