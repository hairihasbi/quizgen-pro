
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Webhook Handler DOKU dengan Notifikasi Email Fisik (Hemat Kuota)
 * Hanya mengirim email asli jika pembayaran sukses.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const CLIENT_ID = process.env.DOKU_CLIENT_ID;
  const SECRET_KEY = process.env.DOKU_SECRET_KEY;
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  const dokuSignature = req.headers['signature']; 
  const requestId = req.headers['request-id'];
  const timestamp = req.headers['request-timestamp'];
  const targetPath = '/api/webhook';

  if (!dokuSignature || !SECRET_KEY || !CLIENT_ID || !TURSO_URL) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const digest = crypto.createHash('sha256').update(rawBody).digest('base64');
    const stringToSign = `Client-Id:${CLIENT_ID}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${targetPath}\nDigest:${digest}`;
    const calculatedSignature = crypto.createHmac('sha256', SECRET_KEY).update(stringToSign).digest('base64');

    if (`HMACSHA256=${calculatedSignature}` !== dokuSignature) {
      return res.status(401).send('Invalid Signature');
    }

    const { order, transaction } = req.body;
    const invoiceId = order.invoice_number;
    const paymentStatus = transaction.status;

    const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    const trxCheck = await db.execute({
      sql: "SELECT * FROM transactions WHERE externalId = ? AND status = 'PENDING'",
      args: [invoiceId]
    });

    if (trxCheck.rows.length === 0) return res.status(200).send('Processed');

    const localTrx = trxCheck.rows[0];
    const isSuccess = paymentStatus === 'SUCCESS' || paymentStatus === 'DONE';
    const finalStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const userId = localTrx.userId as string;

    const userRes = await db.execute({ sql: "SELECT username, email FROM users WHERE id = ?", args: [userId] });
    if (userRes.rows.length === 0) return res.status(404).send('User not found');
    
    const user = userRes.rows[0];
    const userEmail = user.email || `${user.username}@quizgen.pro`;
    const subject = isSuccess ? "⚡ Pembayaran Berhasil!" : "⚠️ Pembayaran Gagal";
    const message = isSuccess 
      ? `Hai ${user.username}, +${localTrx.credits} Kredit AI telah ditambahkan. Invoice: ${invoiceId}.`
      : `Hai ${user.username}, pembayaran untuk invoice ${invoiceId} tidak berhasil kami proses.`;

    // 1. Database Updates (Internal)
    await db.batch([
      { sql: "UPDATE transactions SET status = ? WHERE externalId = ?", args: [finalStatus, invoiceId] },
      ...(isSuccess ? [{ sql: "UPDATE users SET credits = credits + ? WHERE id = ?", args: [Number(localTrx.credits), userId] }] : []),
      {
        sql: "INSERT INTO emails (id, to_addr, subject, body, type, timestamp, isRead) VALUES (?, ?, ?, ?, ?, ?, 0)",
        args: [crypto.randomUUID(), userEmail, subject, message, isSuccess ? "success" : "error", new Date().toISOString()]
      }
    ], "write");

    // 2. REAL EMAIL DISPATCH (Khusus Sukses)
    if (isSuccess) {
      // Ambil konfigurasi email dari DB
      const settingsRes = await db.execute("SELECT data FROM email_settings WHERE id = 'global'");
      if (settingsRes.rows.length > 0) {
        const settings = JSON.parse(settingsRes.rows[0].data as string);
        const emailApiKey = settings.apiKey || process.env.RESEND_API_KEY;

        if (settings.provider === 'resend' && emailApiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${emailApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${settings.senderName} <${settings.fromEmail}>`,
              to: [userEmail],
              subject: subject,
              html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:10px;">
                      <h2 style="color:#ff8c00;">QuizGen Pro Payment</h2>
                      <p>${message}</p>
                      <p style="font-size:12px;color:#999;">Invoice ID: ${invoiceId}</p>
                    </div>`
            })
          });
          console.log(`[RESEND] Priority email sent for invoice ${invoiceId}`);
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error("[WEBHOOK_ERROR]", error.message);
    return res.status(500).send('Error');
  }
}
