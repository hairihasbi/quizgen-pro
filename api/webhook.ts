
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Webhook Handler DOKU - High Precision Validation
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const CLIENT_ID = (process.env.DOKU_CLIENT_ID || "").trim();
  const SECRET_KEY = (process.env.DOKU_SECRET_KEY || "").trim();
  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  // Header dari DOKU (Case insensitive handling oleh Next.js/Vercel)
  const incomingSignature = req.headers['signature'];
  const requestId = req.headers['request-id'];
  const timestamp = req.headers['request-timestamp'];
  const targetPath = '/api/webhook';

  if (!incomingSignature || !SECRET_KEY || !CLIENT_ID || !TURSO_URL) {
    return res.status(401).send('Unauthorized: Missing headers or keys');
  }

  try {
    // 1. Hitung ulang Digest dari body mentah
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const digest = crypto.createHash('sha256').update(rawBody).digest('base64');
    
    // 2. Rekonstruksi String-To-Sign
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digest}`;

    // 3. Hitung Signature
    const calculatedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // 4. Validasi dengan prefix HMACSHA256=
    if (`HMACSHA256=${calculatedSignature}` !== incomingSignature) {
      console.error("[WEBHOOK_SIG_FAILED]", {
        received: incomingSignature,
        expected: `HMACSHA256=${calculatedSignature}`
      });
      return res.status(401).send('Invalid Signature');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const invoiceId = body.order.invoice_number;
    const paymentStatus = body.transaction.status;

    const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    
    // Cek apakah transaksi ada dan masih pending
    const trxCheck = await db.execute({
      sql: "SELECT * FROM transactions WHERE externalId = ? AND status = 'PENDING'",
      args: [invoiceId]
    });

    if (trxCheck.rows.length === 0) {
      return res.status(200).send('Processed or Not Found');
    }

    const localTrx = trxCheck.rows[0];
    const isSuccess = paymentStatus === 'SUCCESS' || paymentStatus === 'DONE';
    const finalStatus = isSuccess ? 'SUCCESS' : 'FAILED';

    // Update Database Atomically
    await db.batch([
      { sql: "UPDATE transactions SET status = ? WHERE externalId = ?", args: [finalStatus, invoiceId] },
      ...(isSuccess ? [{ sql: "UPDATE users SET credits = credits + ? WHERE id = ?", args: [Number(localTrx.credits), localTrx.userId] }] : [])
    ], "write");

    return res.status(200).send('OK');

  } catch (error: any) {
    console.error("[WEBHOOK_INTERNAL_ERROR]", error.message);
    return res.status(500).send('Internal Error');
  }
}
