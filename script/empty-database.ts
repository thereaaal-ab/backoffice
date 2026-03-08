/**
 * Empties all application tables so you can start testing from scratch.
 * Run: npm run db:empty (from project root, with DATABASE_URL in .env)
 */
import "dotenv/config";
import { pool } from "../server/db";

async function main() {
  if (!pool) {
    console.error("❌ DATABASE_URL is not set. Cannot connect to the database.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    // Truncate all app tables. CASCADE also truncates dependent tables (order_items, sale_items, estimate_items, product_variants, product_images, stock_movements).
    await client.query(`
      TRUNCATE TABLE
        users,
        product_categories,
        clients,
        orders,
        sales,
        estimates,
        products
      CASCADE;
    `);
    console.log("✅ Database emptied. All tables truncated. You can start testing from scratch.");
  } catch (err) {
    console.error("❌ Error emptying database:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
