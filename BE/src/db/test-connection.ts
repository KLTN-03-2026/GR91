import 'dotenv/config';
import { pool } from './client.js';

async function testConnection() {
  console.log('Testing MySQL connection...');
  console.log(`  Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  DB:   ${process.env.DB_NAME}`);

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT 1 + 1 AS result');
    console.log('\n✅ Connection successful!', rows);

    // Check if database exists
    const [dbs] = await conn.execute(
      `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [process.env.DB_NAME]
    ) as any[];
    
    if (dbs.length > 0) {
      console.log(`✅ Database "${process.env.DB_NAME}" exists.`);

      // List tables
      const [tables] = await conn.execute('SHOW TABLES') as any[];
      if (tables.length > 0) {
        console.log(`✅ Tables found (${tables.length}):`);
        tables.forEach((t: any) => console.log('   -', Object.values(t)[0]));
      } else {
        console.log('⚠️  No tables yet. Run: npm run db:init');
      }
    } else {
      console.log(`⚠️  Database "${process.env.DB_NAME}" does not exist. Please create it first.`);
    }

    conn.release();
  } catch (err: any) {
    console.error('\n❌ Connection failed:', err.message);
    console.error('   Check your .env credentials.');
  } finally {
    await pool.end();
  }
}

testConnection();
