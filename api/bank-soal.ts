
import { createClient } from '@libsql/client';

/**
 * API untuk Galeri Bank Soal dengan Internal Redis Caching
 * Dioptimalkan agar perubahan status publikasi muncul lebih cepat.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database config missing' });

  const CACHE_KEY = 'bank_soal_public_v2'; 

  try {
    if (REDIS_URL && REDIS_TOKEN) {
      try {
        const cacheRes = await fetch(`${REDIS_URL}/get/${CACHE_KEY}`, {
          headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
        });
        const cacheData = await cacheRes.json();
        if (cacheData.result) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(200).json(JSON.parse(cacheData.result));
        }
      } catch (e) {
        console.warn("[CACHE ERROR] Falling back to SQL");
      }
    }

    const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    const result = await db.execute("SELECT * FROM quizzes WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 100");
    
    // Safety check for result.rows
    const rows = result.rows || [];
    const quizzes = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      level: row.level,
      grade: row.grade,
      topic: row.topic,
      difficulty: row.difficulty,
      authorName: row.authorName || 'Teacher',
      authorId: row.authorId,
      isPublished: true,
      questions: JSON.parse(row.questions || '[]'),
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.createdAt
    }));

    if (REDIS_URL && REDIS_TOKEN && quizzes.length > 0) {
      try {
        await fetch(REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['set', CACHE_KEY, JSON.stringify(quizzes), 'EX', 60])
        });
      } catch (e) {
        console.error("[CACHE SET ERROR]", e);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    return res.status(200).json(quizzes);
  } catch (error: any) {
    console.error("[BANK_SOAL_API_FATAL]", error);
    return res.status(500).json({ message: error.message });
  }
}
