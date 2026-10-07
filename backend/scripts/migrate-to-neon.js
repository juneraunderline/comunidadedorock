const { Pool } = require("pg");

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error("Defina SOURCE_DATABASE_URL e TARGET_DATABASE_URL.");
  process.exit(1);
}

const source = new Pool({
  connectionString: sourceUrl,
  ssl: sourceUrl.includes("fly.dev") || sourceUrl.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

const target = new Pool({
  connectionString: targetUrl,
  ssl: targetUrl.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : false,
});

const schemas = [
  \`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY, title TEXT, content TEXT, image TEXT, link TEXT,
    source TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS bands (
    id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT,
    members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT,
    facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`ALTER TABLE bands ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()\`,
  \`CREATE TABLE IF NOT EXISTS pending_bands (
    id SERIAL PRIMARY KEY, name TEXT, genre TEXT, city TEXT, state TEXT, year TEXT,
    members TEXT, biography TEXT, contact TEXT, image TEXT, instagram TEXT,
    facebook TEXT, youtube TEXT, spotify TEXT, bandcamp TEXT, site TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS rss_feeds (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, logo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY, title TEXT, artist TEXT, date TEXT, time TEXT,
    location TEXT, city TEXT, state TEXT, image TEXT, ticket_link TEXT,
    description TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL, content TEXT,
    image TEXT, date TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
    display_name TEXT, avatar TEXT, role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY, page_type TEXT NOT NULL, page_id INTEGER NOT NULL,
    user_id INTEGER, user_name TEXT NOT NULL, user_avatar TEXT, content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )\`,
  \`CREATE INDEX IF NOT EXISTS idx_bands_created_at ON bands (created_at DESC)\`
];

const tables = [
  "posts", "bands", "pending_bands", "rss_feeds",
  "events", "interviews", "users", "comments"
];

const quote = (name) => '"' + name.replace(/"/g, '""') + '"';

async function migrateTable(table) {
  const columnsResult = await source.query(
    \`SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position\`,
    [table]
  );
  const columns = columnsResult.rows.map(r => r.column_name);

  if (!columns.length) {
    console.log(\`⚠️ Tabela \${table} não existe na origem; pulando.\`);
    return { source: 0, target: 0 };
  }

  const rows = (await source.query(\`SELECT * FROM \${quote(table)} ORDER BY id ASC\`)).rows;
  const targetColumns = columns.map(quote).join(", ");
  const placeholders = columns.map((_, i) => "$" + (i + 1)).join(", ");
  const updateColumns = columns.filter(c => c !== "id");

  for (const row of rows) {
    const values = columns.map(c => row[c]);
    let sql = \`INSERT INTO \${quote(table)} (\${targetColumns}) VALUES (\${placeholders})\`;
    if (updateColumns.length) {
      sql += " ON CONFLICT (id) DO UPDATE SET " +
        updateColumns.map(c => \`\${quote(c)} = EXCLUDED.\${quote(c)}\`).join(", ");
    } else {
      sql += " ON CONFLICT (id) DO NOTHING";
    }
    await target.query(sql, values);
  }

  const seq = await target.query(
    "SELECT pg_get_serial_sequence($1, 'id') AS sequence_name",
    [\`public.\${table}\`]
  );
  const sequenceName = seq.rows[0]?.sequence_name;
  if (sequenceName) {
    await target.query(
      \`SELECT setval($1, COALESCE((SELECT MAX(id) FROM \${quote(table)}), 1), true)\`,
      [sequenceName]
    );
  }

  const targetCount = (await target.query(
    \`SELECT COUNT(*)::int AS count FROM \${quote(table)}\`
  )).rows[0].count;

  return { source: rows.length, target: targetCount };
}

async function main() {
  console.log("🔄 Migrando PostgreSQL → Neon...");
  console.log("⚠️ A origem é somente leitura; nenhum DELETE/UPDATE será executado nela.");

  for (const sql of schemas) {
    await target.query(sql);
  }

  const results = {};
  for (const table of tables) {
    results[table] = await migrateTable(table);
    console.log(\`✅ \${table}: \${results[table].source} origem / \${results[table].target} destino\`);
  }

  console.log("\\n📊 Validação final:");
  for (const [table, result] of Object.entries(results)) {
    if (result.source !== result.target) {
      throw new Error(
        \`Contagem diferente em \${table}: origem=\${result.source}, destino=\${result.target}\`
      );
    }
  }

  console.log("🎉 Migração concluída sem diferenças de quantidade de registros.");
}

main()
  .catch(err => {
    console.error("❌ Migração interrompida:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  });
