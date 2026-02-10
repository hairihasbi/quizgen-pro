
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Webhook Handler DOKU - High Reliability
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // Ambil Header dengan case-insensitive
  const CLIENT_ID = process.env.DOKU_CLIENT_ID;
  const SECRET_KEY = process.env.DOKU_SECRET_KEY;
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  const dokuSignature = req.headers['signature']; 
  const requestId = req.headers['request-id'];
  const timestamp = req.headers['request-timestamp'];
  const targetPath = '/api/webhook'; // Harus sesuai dengan yang didaftarkan di dashboard DOKU

  if (!dokuSignature || !SECRET_KEY || !CLIENT_ID || !TURSO_URL) {
    console.error("[WEBHOOK] Missing Security Components");
    return res.status(401).send('Unauthorized');
  }

  try {
    // Rekonstruksi Signature untuk validasi
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const digest = crypto.createHash('sha256').update(rawBody).digest('base64');
    
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digest}`;

    const calculatedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    if (`HMACSHA256=${calculatedSignature}` !== dokuSignature) {
      console.error("[WEBHOOK] Invalid Signature Detected", {
        received: dokuSignature,
        calculated: `HMACSHA256=${calculatedSignature}`
      });
      return res.status(401).send('Invalid Signature');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { order, transaction } = body;
    const invoiceId = order.invoice_number;
    const paymentStatus = transaction.status;

    const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    
    // Cek transaksi
    const trxCheck = await db.execute({
      sql: "SELECT * FROM transactions WHERE externalId = ? AND status = 'PENDING'",
      args: [invoiceId]
    });

    if (trxCheck.rows.length === 0) {
      return res.status(200).send('Transaction already processed or not found');
    }

    const localTrx = trxCheck.rows[0];
    const isSuccess = paymentStatus === 'SUCCESS' || paymentStatus === 'DONE';
    const finalStatus = isSuccess ? 'SUCCESS' : 'FAILED';
    const userId = localTrx.userId as string;

    // Database Updates
    await db.batch([
      { sql: "UPDATE transactions SET status = ? WHERE externalId = ?", args: [finalStatus, invoiceId] },
      ...(isSuccess ? [{ sql: "UPDATE users SET credits = credits + ? WHERE id = ?", args: [Number(localTrx.credits), userId] }] : [])
    ], "write");

    console.log(`[WEBHOOK] Payment ${finalStatus} for Invoice ${invoiceId}`);
    return res.status(200).send('OK');

  } catch (error: any) {
    console.error("[WEBHOOK_CRITICAL_ERROR]", error.message);
    return res.status(500).send('Internal Error');
  }
}
