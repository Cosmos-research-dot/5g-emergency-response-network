/**
 * PostgreSQL Connection Pool
 * Manages database connections with pooling for performance
 */

const { Pool } = require('pg');
const config = require('./config');

let pool;

/**
 * Initialize connection pool
 */
function initializePool() {
  pool = new Pool(config);

  pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
  });

  pool.on('connect', () => {
    console.log('[DB] Connection established');
  });

  return pool;
}

/**
 * Get connection pool instance
 */
function getPool() {
  if (!pool) {
    initializePool();
  }
  return pool;
}

/**
 * Execute query with pool
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.log(`[DB] Slow query (${duration}ms): ${text.substring(0, 50)}...`);
    }
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message, '\nQuery:', text);
    throw error;
  }
}

/**
 * Execute transaction
 */
async function transaction(callback) {
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

/**
 * Shutdown pool gracefully
 */
async function shutdown() {
  if (pool) {
    await pool.end();
    console.log('[DB] Connection pool closed');
  }
}

module.exports = {
  query,
  transaction,
  getPool,
  initializePool,
  shutdown
};
