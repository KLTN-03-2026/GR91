import 'dotenv/config';
import { pool } from './client.js';

type ColumnInfo = {
  table_name: string;
  column_name: string;
  column_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const DB_NAME = process.env.DB_NAME ?? 'smart_hotel';

const requiredTables = [
  'hotel_info',
  'room_categories',
  'room_types',
  'amenities',
  'room_type_amenities',
  'bed_types',
  'room_type_beds',
  'rooms',
  'room_images',
  'room_prices',
  'room_type_prices',
  'pricing_rules',
  'users',
  'roles',
  'user_roles',
  'bookings',
  'booking_rooms',
  'booking_guests',
  'room_inventory',
  'payment_transactions',
  'reviews',
  'chatbot_sessions',
  'chatbot_messages',
  'activity_logs',
  'payment_logs',
];

const requiredColumns: Record<string, string[]> = {
  bookings: [
    'booking_id',
    'user_id',
    'total_price',
    'paid_amount',
    'remaining_amount',
    'status',
    'created_at',
    'expires_at',
    'payment_policy',
  ],
  payment_transactions: [
    'payment_id',
    'booking_id',
    'amount',
    'method',
    'gateway',
    'type',
    'order_id',
    'trans_id',
    'status',
    'transaction_date',
  ],
  payment_logs: [
    'log_id',
    'payment_id',
    'event_type',
    'status',
    'message',
    'gateway_data',
    'created_at',
  ],
  room_inventory: [
    'inventory_id',
    'room_id',
    'date',
    'is_available',
    'price',
    'status',
    'booking_id',
    'updated_at',
  ],
  reviews: [
    'review_id',
    'booking_id',
    'user_id',
    'room_type_id',
    'rating',
    'comment',
    'created_at',
    'status',
  ],
};

const requiredEnumValues: Record<string, { column: string; values: string[] }[]> = {
  bookings: [
    { column: 'status', values: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'PARTIALLY_PAID', 'CHECKED_IN'] },
    { column: 'payment_policy', values: ['FULL', 'DEPOSIT', 'PAY_AT_HOTEL'] },
  ],
  payment_transactions: [
    { column: 'status', values: ['PENDING', 'SUCCESS', 'FAILED'] },
    { column: 'type', values: ['FULL', 'DEPOSIT', 'REMAINING'] },
  ],
  payment_logs: [
    { column: 'event_type', values: ['INITIATE', 'WEBHOOK_RECEIVED', 'WEBHOOK_VERIFIED', 'SUCCESS', 'FAILED', 'REFUND'] },
  ],
  room_inventory: [
    { column: 'status', values: ['AVAILABLE', 'PENDING', 'BOOKED', 'BLOCKED'] },
  ],
  rooms: [
    { column: 'status', values: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'CLEANING'] },
  ],
};

const requiredIndexes: Record<string, string[][]> = {
  room_inventory: [
    ['room_id', 'date'],
    ['room_id', 'date', 'status'],
    ['booking_id'],
  ],
  payment_transactions: [
    ['order_id', 'gateway'],
    ['booking_id'],
  ],
  payment_logs: [
    ['payment_id'],
    ['created_at'],
    ['event_type'],
  ],
};

const requiredForeignKeys = [
  { table: 'bookings', column: 'user_id', refTable: 'users', refColumn: 'user_id' },
  { table: 'booking_rooms', column: 'booking_id', refTable: 'bookings', refColumn: 'booking_id' },
  { table: 'booking_rooms', column: 'room_id', refTable: 'rooms', refColumn: 'room_id' },
  { table: 'room_inventory', column: 'booking_id', refTable: 'bookings', refColumn: 'booking_id' },
  { table: 'payment_transactions', column: 'booking_id', refTable: 'bookings', refColumn: 'booking_id' },
  { table: 'payment_logs', column: 'payment_id', refTable: 'payment_transactions', refColumn: 'payment_id' },
  { table: 'reviews', column: 'room_type_id', refTable: 'room_types', refColumn: 'type_id' },
];

function normalizeType(type: string) {
  return type.toLowerCase().replace(/\s+/g, '');
}

function enumContains(columnType: string, values: string[]) {
  const normalized = normalizeType(columnType);
  return values.every((value) => normalized.includes(`'${value.toLowerCase()}'`));
}

function printResult(result: CheckResult) {
  const prefix = result.ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ''}`);
}

async function main() {
  const conn = await pool.getConnection();
  const results: CheckResult[] = [];

  try {
    const [tableRows] = await conn.execute(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [DB_NAME],
    ) as any[];
    const tables = new Set((tableRows as { table_name: string }[]).map((row) => row.table_name));

    for (const table of requiredTables) {
      results.push({
        name: `table ${table}`,
        ok: tables.has(table),
        detail: tables.has(table) ? undefined : 'missing table',
      });
    }

    const [columnRows] = await conn.execute(
      `SELECT TABLE_NAME AS table_name,
              COLUMN_NAME AS column_name,
              COLUMN_TYPE AS column_type,
              IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?`,
      [DB_NAME],
    ) as any[];

    const columns = new Map<string, ColumnInfo>();
    for (const row of columnRows as ColumnInfo[]) {
      columns.set(`${row.table_name}.${row.column_name}`, row);
    }

    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      for (const column of expectedColumns) {
        const key = `${table}.${column}`;
        results.push({
          name: `column ${key}`,
          ok: columns.has(key),
          detail: columns.has(key) ? undefined : 'missing column',
        });
      }
    }

    for (const [table, enumRules] of Object.entries(requiredEnumValues)) {
      for (const rule of enumRules) {
        const column = columns.get(`${table}.${rule.column}`);
        results.push({
          name: `enum ${table}.${rule.column}`,
          ok: Boolean(column && enumContains(column.column_type, rule.values)),
          detail: column
            ? `actual=${column.column_type}; required includes ${rule.values.join(',')}`
            : 'missing column',
        });
      }
    }

    const [indexRows] = await conn.execute(
      `SELECT TABLE_NAME AS table_name,
              INDEX_NAME AS index_name,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
       GROUP BY TABLE_NAME, INDEX_NAME`,
      [DB_NAME],
    ) as any[];

    const indexes = (indexRows as { table_name: string; columns: string }[])
      .map((row) => ({ table: row.table_name, columns: row.columns.split(',') }));

    for (const [table, expectedIndexes] of Object.entries(requiredIndexes)) {
      for (const expectedColumns of expectedIndexes) {
        const ok = indexes.some((index) =>
          index.table === table &&
          expectedColumns.every((column, indexPosition) => index.columns[indexPosition] === column),
        );
        results.push({
          name: `index ${table}(${expectedColumns.join(',')})`,
          ok,
          detail: ok ? undefined : 'missing index with required leading columns',
        });
      }
    }

    const [fkRows] = await conn.execute(
      `SELECT TABLE_NAME AS table_name,
              COLUMN_NAME AS column_name,
              REFERENCED_TABLE_NAME AS ref_table,
              REFERENCED_COLUMN_NAME AS ref_column
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [DB_NAME],
    ) as any[];

    const foreignKeys = fkRows as {
      table_name: string;
      column_name: string;
      ref_table: string;
      ref_column: string;
    }[];

    for (const fk of requiredForeignKeys) {
      const ok = foreignKeys.some((row) =>
        row.table_name === fk.table &&
        row.column_name === fk.column &&
        row.ref_table === fk.refTable &&
        row.ref_column === fk.refColumn,
      );
      results.push({
        name: `fk ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`,
        ok,
        detail: ok ? undefined : 'missing foreign key',
      });
    }

    const failed = results.filter((result) => !result.ok);
    results.forEach(printResult);

    console.log('');
    console.log(`Schema audit completed: ${results.length - failed.length}/${results.length} checks passed.`);

    if (failed.length) {
      process.exitCode = 1;
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Schema audit failed:', error);
  process.exitCode = 1;
});
