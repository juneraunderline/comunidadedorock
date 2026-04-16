const { Pool } = require("pg");

const OLD_DB = "postgresql://comunidadedorock_db_user:D16tBQlo8yxv4qMMNUSMUt6GKvvqvIim@dpg-d77tsmp4bi0s73f5nt4g-a.oregon-postgres.render.com/comunidadedorock_db";
const NEW_DB = "postgresql://neondb_owner:npg_UgA3b4DyXSVw@ep-dawn-union-acay03p6.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const oldPool = new Pool({ connectionString: OLD_DB, ssl: { rejectUnauthorized: false } });
const newPool = new Pool({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } });

async function migrate() {
  console.log("🔄 Iniciando migração...\n");

  // Criar tabelas no novo banco
  const createTables = [
    `CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title TEXT, content TEXT, image TEXT, link TEXT, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT)`,
    `CREATE TABLE IF NOT EXISTS pending_bands (id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT, members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT, facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS rss_feeds (id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, logo TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title TEXT, artist TEXT, date TEXT, time TEXT, location TEXT, city TEXT, state TEXT, image TEXT, ticket_link TEXT, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS interviews (id SERIAL PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, content TEXT, image TEXT, date TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, display_name TEXT, avatar TEXT, role TEXT DEFAULT 'user', created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, page_type TEXT NOT NULL, page_id INTEGER NOT NULL, user_id INTEGER, user_name TEXT NOT NULL, user_avatar TEXT, content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`
  ];

  for (const sql of createTables) {
    await newPool.query(sql);
  }
  console.log("✅ Tabelas criadas no Neon\n");

  // Migrar dados
  const tables = ["posts", "bands", "pending_bands", "rss_feeds", "events", "interviews", "users"];

  for (const table of tables) {
    try {
      const { rows } = await oldPool.query("SELECT * FROM " + table);
      console.log(table + ": " + rows.length + " registros encontrados");

      if (rows.length === 0) continue;

      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((_, i) => "$" + (i + 1));
        try {
          await newPool.query(
            "INSERT INTO " + table + " (" + cols.join(",") + ") VALUES (" + vals.join(",") + ")",
            Object.values(row)
          );
          inserted++;
        } catch (e) {
          // Registro duplicado, pular
        }
      }
      console.log("  ✅ " + inserted + " inseridos em " + table);

      // Atualizar sequence do ID
      try {
        await newPool.query("SELECT setval(pg_get_serial_sequence('" + table + "', 'id'), (SELECT COALESCE(MAX(id), 1) FROM " + table + "))");
      } catch (e) {}

    } catch (e) {
      console.log("  ❌ Erro em " + table + ": " + e.message);
    }
  }

  console.log("\n🎉 MIGRAÇÃO COMPLETA!");
  await oldPool.end();
  await newPool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
