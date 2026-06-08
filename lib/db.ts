/**
 * MEDICA Database Utility
 * Singleton PostgreSQL pool using the `pg` library.
 * Reads DATABASE_URL from environment variables.
 * Pool is lazily created at first request time (not at build time).
 */
import { Pool, QueryResult, QueryResultRow } from "pg";

// Extend global to cache pool across hot-reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (global._pgPool) return global._pgPool;
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }
  // Convert python-specific asyncpg/psycopg2 protocol schemes if they exist
  connectionString = connectionString.replace("postgresql+asyncpg://", "postgresql://")
                                     .replace("postgresql+psycopg2://", "postgresql://");
  global._pgPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
  return global._pgPool;
}

/** Run a parameterised query and return rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
