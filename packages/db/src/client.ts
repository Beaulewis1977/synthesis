import { Pool, type PoolClient, type QueryResult } from 'pg';

let pool: Pool | undefined;

export function getPool(connectionString?: string): Pool {
  if (!pool) {
    const connString = connectionString || process.env.DATABASE_URL;

    if (!connString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: connString,
      max: 20, // Max connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle errors
    pool.on('error', (err) => {
      console.error('Unexpected database error', err);
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

// Helper for transactions
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Export query method for convenience
export async function query(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<QueryResult> {
  return getPool().query(text, params);
}
