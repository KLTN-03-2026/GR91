/**
 * Run: npx tsx src/db/fix-images.ts
 * Xóa các ảnh base64 bị split lỗi, giữ lại URL hợp lệ
 */
import 'dotenv/config';
import { pool } from './client.js';

async function fixImages() {
  const conn = await pool.getConnection();
  try {
    // Xem tất cả ảnh hiện tại
    const [rows] = await conn.execute(
      'SELECT image_id, room_id, LEFT(url, 80) as url_preview FROM room_images ORDER BY room_id, image_id'
    ) as any[];

    console.log('Current images:');
    (rows as any[]).forEach((r: any) => console.log(`  id=${r.image_id} room=${r.room_id} url=${r.url_preview}`));

    // Xóa tất cả ảnh có URL không bắt đầu bằng http (base64 lỗi)
    const [del1] = await conn.execute(
      `DELETE FROM room_images WHERE url NOT LIKE 'http%'`
    ) as any[];
    console.log(`\nDeleted ${(del1 as any).affectedRows} invalid image rows`);

    // Xem còn lại
    const [remaining] = await conn.execute(
      'SELECT image_id, room_id, url FROM room_images ORDER BY room_id, image_id'
    ) as any[];
    console.log(`\nRemaining: ${(remaining as any[]).length} images`);
    (remaining as any[]).forEach((r: any) => console.log(`  id=${r.image_id} room=${r.room_id} url=${r.url}`));

  } finally {
    conn.release();
    await pool.end();
  }
}

fixImages().catch(console.error);
