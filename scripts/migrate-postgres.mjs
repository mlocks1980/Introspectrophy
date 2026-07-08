import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run PostgreSQL migrations.");
}

const { Client } = await import("pg");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" || process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  const sql = await readFile("migrations/001_introspectropy_sros.sql", "utf8");
  await client.query(sql);
  console.log("PostgreSQL migration applied.");
} finally {
  await client.end();
}
