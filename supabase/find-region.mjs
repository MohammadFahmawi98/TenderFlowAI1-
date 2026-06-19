import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Client } = require("pg");

const REGIONS = [
  "aws-0-eu-central-1",
  "aws-0-us-east-1",
  "aws-0-us-west-1",
  "aws-0-ap-southeast-1",
  "aws-0-ap-northeast-1",
  "aws-0-me-central-1",
  "aws-0-sa-east-1",
  "aws-0-eu-west-2",
  "aws-0-ap-south-1",
];

const [, , password] = process.argv;
const REF = "mjtzqtvwfpumlopdarae";

for (const region of REGIONS) {
  const cs = `postgresql://postgres.${REF}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`;
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
  try {
    await client.connect();
    console.log("✓ Found region:", region);
    await client.end();
    process.exit(0);
  } catch {
    process.stdout.write(`  ✗ ${region}\n`);
  }
}
console.log("Could not connect to any region — check password or Supabase project status.");
process.exit(1);
