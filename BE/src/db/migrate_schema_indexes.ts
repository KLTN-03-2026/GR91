import 'dotenv/config';
import { pool } from './client.js';

const DB_NAME = process.env.DB_NAME ?? 'smart_hotel';

async function indexExists(tableName: string, indexName: string) {
  const [rows] = await pool.execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [DB_NAME, tableName, indexName],
  ) as any[];

  return rows.length > 0;
}

async function addIndexIfMissing(tableName: string, indexName: string, columnsSql: string) {
  if (await indexExists(tableName, indexName)) {
    console.log(`Skip ${indexName}: already exists`);
    return;
  }

  await pool.execute(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` (${columnsSql})`);
  console.log(`Added ${indexName}`);
}

async function main() {
  await addIndexIfMissing('payment_logs', 'idx_payment_logs_created', '`created_at`');
  await addIndexIfMissing('payment_logs', 'idx_payment_logs_event', '`event_type`');
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    console.error('Schema index migration failed:', error);
    await pool.end();
    process.exitCode = 1;
  });
