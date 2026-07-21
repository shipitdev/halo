/**
 * Halo Server — Database Migrations
 * Creates tables for users, sessions, and usage tracking.
 * Run with: node src/migrate.js
 */

require('dotenv').config();
const { pool } = require('./db');

const MIGRATIONS = [
  {
    name: 'create_users_table',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        plan          VARCHAR(50) DEFAULT 'free',
        stripe_customer_id VARCHAR(255),
        created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  },
  {
    name: 'create_sessions_table',
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(512) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `,
  },
  {
    name: 'create_usage_table',
    sql: `
      CREATE TABLE IF NOT EXISTS usage (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider    VARCHAR(50) NOT NULL,
        model       VARCHAR(100),
        tokens_used INTEGER DEFAULT 0,
        action      VARCHAR(50),
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
    `,
  },
  {
    name: 'create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
  },
];

async function migrate() {
  const client = await pool.connect();

  try {
    // Ensure migrations tracking table exists first
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    for (const migration of MIGRATIONS) {
      // Check if already applied
      const result = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [migration.name]
      );

      if (result.rows.length > 0) {
        console.log(`  ✓ ${migration.name} (already applied)`);
        continue;
      }

      // Apply migration
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`  ✦ ${migration.name} — applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('\n✦ All migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  console.log('✦ Running Halo database migrations...\n');
  migrate();
}

module.exports = { migrate };
