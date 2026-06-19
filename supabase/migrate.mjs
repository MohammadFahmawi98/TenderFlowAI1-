/**
 * TenderFlow migration runner.
 * Uses the Supabase "Transaction" pooler connection string.
 * Connection: postgres://postgres.{ref}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres
 *
 * USAGE: node supabase/migrate.mjs <DB_PASSWORD>
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const [, , dbPassword] = process.argv;
if (!dbPassword) {
  console.error("Usage: node supabase/migrate.mjs <DB_PASSWORD>");
  process.exit(1);
}

const REF = "mjtzqtvwfpumlopdarae";
// Supabase session pooler (port 5432) — works without pgbouncer restrictions
const connectionString =
  `postgresql://postgres.${REF}:${encodeURIComponent(dbPassword)}@aws-0-me-central-1.pooler.supabase.com:5432/postgres`;

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("✓ Connected to Supabase");
  await client.query(sql);
  console.log("✓ Schema applied successfully");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
