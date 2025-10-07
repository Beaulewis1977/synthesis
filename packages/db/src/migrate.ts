import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closePool, getPool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs database migrations from the `../migrations` directory.
 * It creates a `migrations` table to track applied migrations and applies any pending ones.
 * @param connectionString The database connection string. If not provided, it uses the DATABASE_URL environment variable.
 * @throws Will throw an error if any migration fails.
 */
export async function runMigrations(connectionString?: string): Promise<void> {
  const pool = getPool(connectionString);
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const { rows: applied } = await pool.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY id'
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Get migration files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('_down.sql'))
      .sort();

    console.log(`Found ${files.length} migration files`);
    console.log(`Already applied: ${appliedSet.size} migrations`);

    // Apply pending migrations
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`📝 Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('✅ All migrations applied successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Allow running directly
if (import.meta.url === pathToFileURL(process.argv[1])?.href) {
  runMigrations()
    .then(() => {
      console.log('Migration complete');
      return closePool();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration error:', err);
      closePool().then(() => process.exit(1));
    });
}
