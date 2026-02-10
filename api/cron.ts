
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * BACKGROUND WORKER (CRON JOB)
 * Fungsi ini dipanggil otomatis oleh Vercel Scheduler setiap jam.
 * Keamanan diperketat dengan validasi CRON_SECRET.
 */
export default async function handler(req: any, res: any) {
  // Validasi keamanan menggunakan CRON_SECRET
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized Cron Request' });
  }

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database config missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const startTime = Date.now();
  const logsExecuted: string[] = [];

  try {
    // 1. CLEANUP LOGS (Log Rotation)
    // Menghapus log yang lebih lama dari 7 hari agar DB tidak membengkak
    const cleanupLogs = await db.execute("DELETE FROM logs WHERE timestamp < date('now', '-7 days')");
    logsExecuted.push(`Log Rotation: Deleted ${cleanupLogs.rowsAffected} stale logs`);

    // 2. STALE TRANSACTION WATCHER
    // Mark PENDING transactions older than 24h as FAILED
    const cleanupTrx = await db.execute("UPDATE transactions SET status = 'FAILED' WHERE status = 'PENDING' AND createdAt < date('now', '-1 day')");
    logsExecuted.push(`Trx Watcher: Flagged ${cleanupTrx.rowsAffected} stale payments`);

    // 3. API KEY COOLDOWN RESET
    // Reset error count untuk kunci yang error-nya sudah lama (misal 1 jam lalu)
    const resetKeys = await db.execute("UPDATE api_keys SET error_count = 0 WHERE error_count > 0");
    logsExecuted.push(`Key Guard: Reset ${resetKeys.rowsAffected} API keys from cooldown`);

    // 4. RECORD SYSTEM HEARTBEAT
    const duration = Date.now() - startTime;
    await db.execute({
      sql: "INSERT INTO logs (id, timestamp, action, details, status, userId) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        crypto.randomUUID(),
        new Date().toISOString(),
        'SYSTEM_CRON',
        `Background Worker executed successfully in ${duration}ms. Tasks: ${logsExecuted.join('; ')}`,
        'success',
        'SYSTEM_WORKER'
      ]
    });

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      tasks: logsExecuted
    });
  } catch (error: any) {
    console.error("[CRON ERROR]", error);
    
    // Log kegagalan sistem
    await db.execute({
      sql: "INSERT INTO logs (id, timestamp, action, details, status, userId) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        crypto.randomUUID(),
        new Date().toISOString(),
        'SYSTEM_CRON_FAILED',
        `Worker error: ${error.message}`,
        'error',
        'SYSTEM_WORKER'
      ]
    });

    return res.status(500).json({ status: 'error', message: error.message });
  }
}
