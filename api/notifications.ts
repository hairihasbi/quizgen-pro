
import { createClient } from '@libsql/client';
import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  try {
    // 1. GET: Ambil notifikasi atau info sistem
    if (req.method === 'GET') {
      const { action, userId, page = '1', limit = '10' } = req.query;

      if (action === 'sys-info') {
        return res.status(200).json({
          resendEnvFound: !!process.env.RESEND_API_KEY,
          dokuClientIdEnvFound: !!process.env.DOKU_CLIENT_ID,
          dokuSecretKeyEnvFound: !!process.env.DOKU_SECRET_KEY,
          nodeEnv: process.env.NODE_ENV || 'development'
        });
      }

      if (!userId) return res.status(400).json({ message: 'User ID required' });

      const p = parseInt(page as string) || 1;
      const l = parseInt(limit as string) || 10;
      const offset = (p - 1) * l;

      const userRes = await db.execute({
        sql: "SELECT email, username FROM users WHERE id = ?",
        args: [userId]
      });
      
      if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
      const userEmail = userRes.rows[0].email || `${userRes.rows[0].username}@quizgen.pro`;

      const result = await db.execute({
        sql: "SELECT * FROM emails WHERE to_addr = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        args: [userEmail, l + 1, offset]
      });

      const emails = result.rows.map(row => ({
        id: row.id,
        to: row.to_addr,
        subject: row.subject,
        body: row.body,
        type: row.type,
        timestamp: row.timestamp,
        isRead: Boolean(row.isRead)
      }));

      const hasMore = emails.length > l;
      return res.status(200).json({
        emails: hasMore ? emails.slice(0, l) : emails,
        hasMore
      });
    }

    // 2. PATCH: Tandai notifikasi sebagai telah dibaca
    if (req.method === 'PATCH') {
      const { id } = req.body;
      await db.execute({
        sql: "UPDATE emails SET isRead = 1 WHERE id = ?",
        args: [id]
      });
      return res.status(200).json({ success: true });
    }

    // 3. POST: Kirim notifikasi baru
    if (req.method === 'POST') {
      const { to, subject, body, type } = req.body;
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO emails (id, to_addr, subject, body, type, timestamp, isRead) VALUES (?, ?, ?, ?, ?, ?, 0)",
        args: [id, to, subject, body, type, timestamp]
      });

      return res.status(200).json({ id, timestamp });
    }

    // 4. DELETE: Hapus massal notifikasi
    if (req.method === 'DELETE') {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Array IDs required' });
      }

      // Membangun query dinamis untuk IN clause
      const placeholders = ids.map(() => '?').join(',');
      await db.execute({
        sql: `DELETE FROM emails WHERE id IN (${placeholders})`,
        args: ids
      });

      return res.status(200).json({ success: true, deletedCount: ids.length });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error: any) {
    console.error("[NOTIF_API_ERROR]", error);
    return res.status(500).json({ message: error.message });
  }
}
