/**
 * TenderFlow migration runner — direct connection (bypasses pooler).
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const [, , dbPassword] = process.argv;
if (!dbPassword) { console.error("Usage: node supabase/migrate-direct.mjs <DB_PASSWORD>"); process.exit(1); }

const REF = "mjtzqtvwfpumlopdarae";

// Try direct host first, then pooler variants
const candidates = [
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${REF}.supabase.co:5432/postgres`,
  `postgresql://postgres.${REF}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${REF}:${encodeURIComponent(dbPassword)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
];

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

for (const cs of candidates) {
  const host = cs.match(/@([^:]+):/)?.[1];
  process.stdout.write(`Trying ${host}… `);
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    console.log("connected!");
    console.log("Applying schema…");
    await client.query(sql);
    console.log("✓ Schema applied successfully!");
    await client.end();
    process.exit(0);
  } catch (err) {
    console.log(`failed: ${err.message.split("\n")[0]}`);
    try { await client.end(); } catch { /**/ }
  }
}

console.log("\n✗ Could not connect. Try running the SQL manually in the Supabase SQL Editor:");
console.log(`  https://supabase.com/dashboard/project/${REF}/sql/new`);
process.exit(1);
