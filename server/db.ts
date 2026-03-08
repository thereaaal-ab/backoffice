import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL not set — starting in UI-preview mode (no database)");
} else {
  const connectionString = process.env.DATABASE_URL.trim();
  const isSupabase = connectionString.includes("supabase.co");
  pool = new Pool({
    connectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  });
  db = drizzle(pool, { schema });
}

export { pool, db };
