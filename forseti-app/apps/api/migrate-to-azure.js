/**
 * SQLite to PostgreSQL Migration Script
 *
 * Migrates data from local SQLite dev.db to Azure PostgreSQL
 * Run with: node migrate-to-azure.js
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');
const path = require('path');

// Configuration
const SQLITE_PATH = path.join(__dirname, 'prisma', 'dev.db');
const POSTGRES_URL = process.env.DATABASE_URL || 'postgresql://derenforsetiadmin:!TelemetryMaster2025@forseti-dev-db.postgres.database.azure.com:5432/forseti?sslmode=require';

// Tables in dependency order (parent tables first)
const TABLES = [
  'User',
  'Activity',
  'ActivityMedia',
  'Follow',
  'DriverSubscription',
  'Notification',
  'Comment',
  'Like',
  'TelemetryData',
  'TelemetryPoint',
  'AnalystNote',
  'Drill'
];

async function migrate() {
  console.log('Starting migration from SQLite to PostgreSQL...\n');

  // Connect to SQLite
  console.log(`Opening SQLite database: ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Connect to PostgreSQL
  console.log('Connecting to PostgreSQL...');
  const pg = new Client({ connectionString: POSTGRES_URL });
  await pg.connect();
  console.log('Connected to PostgreSQL!\n');

  try {
    // Note: Azure PostgreSQL doesn't allow disabling FK checks via session_replication_role
    // We insert in dependency order to handle foreign keys

    for (const table of TABLES) {
      console.log(`\n--- Migrating table: ${table} ---`);

      // Get data from SQLite
      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      console.log(`Found ${rows.length} rows in SQLite`);

      if (rows.length === 0) {
        console.log('Skipping empty table');
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(rows[0]);

      // Build INSERT statement
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const quotedColumns = columns.map(c => `"${c}"`).join(', ');
      const insertSQL = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        // Convert values for PostgreSQL
        const values = columns.map(col => {
          let val = row[col];

          // Handle SQLite integers that should be booleans
          if (col === 'isPro' || col === 'isFoundingDriver' || col === 'isPrivate' || col === 'read') {
            val = val === 1 || val === true;
          }

          // Handle dates - SQLite stores as ISO strings or timestamps
          if (col === 'createdAt' || col === 'updatedAt' || col === 'date' || col === 'completedAt') {
            if (val && typeof val === 'number') {
              val = new Date(val).toISOString();
            }
          }

          return val;
        });

        try {
          await pg.query(insertSQL, values);
          inserted++;
        } catch (err) {
          if (err.code === '23505') { // Unique violation
            skipped++;
          } else {
            console.error(`Error inserting row:`, err.message);
            console.error('Row data:', JSON.stringify(row, null, 2).substring(0, 200));
          }
        }
      }

      console.log(`Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    }

    console.log('\n\n=== Migration Complete! ===\n');

    // Print summary
    console.log('Summary of migrated data:');
    for (const table of TABLES) {
      const result = await pg.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`  ${table}: ${result.rows[0].count} rows`);
    }

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    sqlite.close();
    await pg.end();
  }
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
